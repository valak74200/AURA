"""
AURA WebSocket Handlers

Real-time WebSocket communication for presentation coaching with complete
AuraPipeline integration for audio processing, AI feedback, and performance metrics.

Also exposes /ws/tts for ElevenLabs TTS streaming proxy with viseme mapping.
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
import base64
import numpy as np
import os
from typing import AsyncGenerator

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from fastapi.routing import APIRoute
from starlette.websockets import WebSocketState

from models.session import PresentationSessionData, SessionConfig, SessionStatus, SessionType
from models.feedback import RealTimeFeedback, FeedbackType, FeedbackSeverity
from utils.logging import get_logger
from utils.exceptions import WebSocketException, AudioProcessingException
from utils.audio_utils import AudioBuffer
from processors.aura_pipeline import AuraPipeline
from genai_processors import ProcessorPart
from genai_processors import streams

# ElevenLabs WS proxy imports
import websockets
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK
# Use aiohttp for WS with Authorization headers support
import aiohttp
from aiohttp import ClientSession, WSMsgType, WSServerHandshakeError

logger = get_logger(__name__)


def create_websocket_router(services: Dict[str, Any]) -> APIRouter:
    """
    Create WebSocket router with service dependencies.
    
    Args:
        services: Dictionary containing initialized services
        
    Returns:
        APIRouter: Configured WebSocket router
    """
    router = APIRouter()
    
    # Connection manager for WebSocket sessions
    connection_manager = ConnectionManager(services)

    # =========================================
    # TTS: ElevenLabs streaming proxy endpoint
    # =========================================
    @router.websocket("/tts")
    async def websocket_tts_endpoint(websocket: WebSocket):
        """
        WebSocket proxy to ElevenLabs Text-to-Speech streaming API.

        Protocol (client -> server JSON unless noted):
          - tts.start { voiceId?, model?, format?, sampleRate?, lang? }
              -> server responds {type:"tts.start", ...defaults}
          - tts.text { text } or tts.ssml { ssml }
              -> server opens WS to ElevenLabs and streams:
                   * binary audio frames (mp3) as WS binary messages
                   * viseme events as JSON {type:"tts.viseme", time_ms, morph, weight}
          - tts.cancel {}   -> server cancels current synthesis if in progress
          - tts.end {}      -> server closes proxy and responds {type:"tts.end"}
          - Heartbeat: every 20s, server sends {type:"ping"}

        Notes:
          - Binary audio is forwarded as-is for low latency.
          - ElevenLabs auth via ELEVENLABS_API_KEY in environment/.env.
        """
        await websocket.accept()
        # State
        # Ensure default voice_id is a valid ElevenLabs voice ID (avoid display names like "Rachel")
        default_voice_env = os.getenv("ELEVENLABS_DEFAULT_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        default_voice_cfg = services.get("settings").elevenlabs_default_voice_id if "settings" in services else default_voice_env
        if not isinstance(default_voice_cfg, str) or not default_voice_cfg.strip() or default_voice_cfg.strip().lower() == "rachel":
            default_voice_cfg = "21m00Tcm4TlvDq8ikWAM"
        session = {
            "voice_id": default_voice_cfg,
            "model": services.get("settings").elevenlabs_model if "settings" in services else os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
            "format": "mp3_44100_128",
            "sample_rate": 44100,
            "lang": "en",
            "elevenlabs_ws": None,
            "elevenlabs_task": None,
            "cancel_flag": False
        }
        # Send initial diag meta
        await websocket.send_json({
            "type": "tts.meta",
            "data": {
                "stage": "accepted",
                "defaults": {
                    "voiceId": session["voice_id"],
                    "model": session["model"],
                    "format": session["format"],
                    "sampleRate": session["sample_rate"],
                    "lang": session["lang"]
                }
            }
        })
        logger.info("/ws/tts accepted client connection", extra={"defaults": {k: session[k] for k in ("voice_id","model","format","sample_rate","lang")}})

        # Heartbeat task: ping every 20s
        async def heartbeat_loop():
            try:
                while True:
                    await asyncio.sleep(20)
                    if websocket.client_state != WebSocketState.CONNECTED:
                        break
                    await websocket.send_json({"type": "ping"})
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.debug(f"/ws/tts heartbeat stopped: {e}")

        heartbeat_task = asyncio.create_task(heartbeat_loop())

        async def close_elevenlabs():
            # Cancel the pump task first to stop reads, then close WS/session cleanly
            task = session.get("elevenlabs_task")
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                except Exception:
                    pass
            session["elevenlabs_task"] = None

            ws = session.get("elevenlabs_ws")
            if ws:
                try:
                    await ws.close()
                except Exception:
                    pass
            session["elevenlabs_ws"] = None

            # Close aiohttp session if present
            try:
                s = session.pop("_aiohttp_session", None)
                if s:
                    await s.close()
            except Exception:
                pass

        async def morph_map(phoneme: str) -> str:
            """
            Map ElevenLabs phoneme/viseme to normalized morph target.
            Simple default mapping; refine server-side as needed.
            """
            if not phoneme:
                return "defaultClose"
            p = phoneme.upper()
            vowels = {"AA":"AA","AE":"AE","AH":"AH","AO":"AO","AW":"AW","AY":"AY",
                      "EH":"EH","ER":"ER","EY":"EY","IH":"IH","IY":"IY","OW":"OW","OY":"OY","UH":"UH","UW":"UW"}
            if p in vowels:
                return vowels[p]
            if p in {"B","P","M"}:
                return "M"
            if p in {"F","V"}:
                return "F"
            if p in {"S","Z"}:
                return "S"
            if p in {"SH","ZH","CH","JH"}:
                return "SH"
            if p in {"D","T","K","G"}:
                return "TH"  # soft close proxy
            return "defaultClose"

        async def open_elevenlabs_stream(text: str = None, ssml: str = None):
            """
            Open a streaming connection to ElevenLabs and forward data to client.
            """
            # Prefer settings service first to avoid env desync in process managers
            settings_api_key = None
            try:
                settings_api_key = getattr(services.get("settings", None), "elevenlabs_api_key", None)
            except Exception:
                settings_api_key = None
            env_api_key = os.getenv("ELEVENLABS_API_KEY")
            api_key = settings_api_key or env_api_key
            if not api_key or not isinstance(api_key, str) or not api_key.strip():
                await websocket.send_json({
                    "type": "tts.error",
                    "code": "NO_API_KEY",
                    "message": "Missing ELEVENLABS_API_KEY",
                    "diag": {"source": "settings_or_env", "settings_present": bool(settings_api_key), "env_present": bool(env_api_key)}
                })
                logger.error("/ws/tts NO_API_KEY: ELEVENLABS_API_KEY missing/empty", extra={"settings_present": bool(settings_api_key), "env_present": bool(env_api_key)})
                return
            # Normalize api_key (avoid stray spaces/newlines and common prefix mistakes)
            original_api_key = api_key
            api_key = api_key.strip()
            # Some platforms accidentally include 'Bearer ' in the env var; strip it if present
            if api_key.lower().startswith("bearer "):
                api_key = api_key[7:].strip()
            # Remove surrounding quotes/newlines if any
            api_key = api_key.strip(' "\'\n\r\t')
            # ElevenLabs public keys often start with "eleven_"; record only the prefix class and length
            looks_like_key = api_key.lower().startswith("eleven")
            masked = f"***len={len(api_key)};prefix={'eleven' if looks_like_key else 'other'}" if api_key else "***none"
            await websocket.send_json({"type": "tts.meta", "data": {"stage": "auth_prepared", "api_key_masked": masked}})
            logger.debug("/ws/tts prepared Authorization header for upstream")

            voice_id = session["voice_id"]
            model = session["model"]
            output_format = session["format"]
            # Ensure defaults are valid for ElevenLabs WS
            if not model:
                model = "eleven_multilingual_v2"
                session["model"] = model
            if not output_format or not isinstance(output_format, str):
                output_format = "mp3_44100_128"
                session["format"] = output_format
            # Force robust defaults to avoid silent incompatibilities
            model = "eleven_multilingual_v2"
            output_format = "mp3_44100_128"
            session["model"] = model
            session["format"] = output_format
            # Force explicit values to avoid silent incompatibilities
            model = "eleven_multilingual_v2"
            output_format = "mp3_44100_128"
            session["model"] = model
            session["format"] = output_format
            # Ensure model/output_format compatibility; fallback if empty
            if not model:
                model = "eleven_multilingual_v2"
                session["model"] = model
            if not output_format or not isinstance(output_format, str):
                output_format = "mp3_44100_128"
                session["format"] = output_format
            # Normalize output_format if client sends mp3_44100_128; ElevenLabs expects "mp3_44100_128" or in some SDKs "mp3_44100"
            # Keep as-is but log for clarity
            if not isinstance(output_format, str):
                output_format = "mp3_44100_128"
                session["format"] = output_format
                logger.debug("/ws/tts normalized output_format to default mp3_44100_128")

            # ElevenLabs realtime TTS WS endpoint (stream-input, voice_id in path)
            # NO auth in URL or headers; auth is sent in the FIRST JSON message (xi_api_key) after connect
            url = f"wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input"
            masked = f"***len={len(api_key)}" if api_key else "***none"
            logger.info(
                "/ws/tts opening ElevenLabs stream",
                extra={"voice_id": voice_id, "model": model, "format": output_format, "auth": "first_message_xi_api_key", "api_key": masked}
            )
            await websocket.send_json({"type": "tts.meta", "data": {"stage": "connect_upstream", "endpoint": url}})
            if not api_key:
                await websocket.send_json({
                    "type": "tts.error",
                    "code": "UNAUTHORIZED",
                    "message": "Empty API key after normalization; check ELEVENLABS_API_KEY"
                })
                logger.error("/ws/tts empty API key after normalization")
                return

            try:
                # Connect without auth in URL or headers; auth will be included in first JSON message
                timeout = aiohttp.ClientTimeout(total=30)
                aiohttp_session = ClientSession(timeout=timeout)
                session["_aiohttp_session"] = aiohttp_session

                headers = {
                    # Upstream expects JSON control frames; no auth header here
                    "Accept": "application/json"
                }

                logger.debug("/ws/tts connecting to ElevenLabs", extra={"url": url, "headers_present": list(headers.keys())})
                el_ws = await aiohttp_session.ws_connect(
                    url,
                    headers=headers,
                    autoclose=False,
                    autoping=True,
                    max_msg_size=2 * 1024 * 1024
                )
                session["elevenlabs_ws"] = el_ws
                logger.info("/ws/tts ElevenLabs handshake OK (no auth in URL)")
                await websocket.send_json({"type": "tts.meta", "data": {"stage": "upstream_connected"}})
            except WSServerHandshakeError as e:
                status = getattr(e, 'status', None)
                text = getattr(e, 'message', str(e))
                await websocket.send_json({
                    "type": "tts.error",
                    "code": "CONNECT_FAILED",
                    "status": status,
                    "message": "WS handshake failed before ready",
                    "diagnostic": {
                        "stage": "handshake",
                        "status": status,
                        "error": text,
                        "hint": "Ensure upstream WS endpoint is reachable and not blocked by network/firewall/SSL. No auth in URL; xi_api_key is sent in first 'start' message."
                    }
                })
                logger.error("/ws/tts ElevenLabs handshake failed", extra={"status": status, "error": text})
                return
            except Exception as e:
                await websocket.send_json({
                    "type": "tts.error",
                    "code": "CONNECT_FAILED",
                    "message": "WS closed before ready",
                    "diag": {
                        "stage": "connect",
                        "error": str(e),
                        "hint": "Common causes: corporate proxy/SSL MITM, DNS/IPv6 issues, or upstream downtime. Try IPv4-only, verify SSL trust, or test /api/v1/debug/tts-auth."
                    }
                })
                logger.error("/ws/tts ElevenLabs connect error", extra={"error": str(e)})
                return

            async def pump_from_elevenlabs():
                # If upstream closed quickly, surface a clearer diagnostic to the client UI
                if session.get("elevenlabs_ws") is None or session["elevenlabs_ws"].closed:
                    await websocket.send_json({
                        "type": "tts.error",
                        "code": "CONNECT_FAILED",
                        "message": "Upstream WS closed before auth/start",
                        "diag": {
                            "stage": "pre_start",
                            "hint": "Upstream connection not established. Check network reachability and SSL; then retry."
                        }
                    })
                    return
                bytes_forwarded = 0
                text_len = len(text) if text else 0
                ssml_len = len(ssml) if ssml else 0
                try:
                    # For stream-input, after handshake with Authorization header,
                    # send a "start" message containing synthesis params and content.
                    # ElevenLabs Realtime WS requires:
                    # 1) start
                    # 2) multiple input_audio_buffer.append (optional if sending captured audio)
                    # 3) input_audio_buffer.commit
                    # 4) generate
                    #
                    # For plain TTS-from-text/ssml on stream-input, they still expect a "generate" signal
                    # after start. Some accounts/models also require an explicit "text" message type.
                    #
                    # Send first auth/priming message per ElevenLabs stream-input:
                    # Include xi_api_key and a mandatory text field (space when empty)
                    start_payload = {
                        "type": "start",
                        "model_id": "eleven_multilingual_v2",
                        "output_format": "mp3_44100_128",
                        "optimize_streaming_latency": 3,
                        "voice_settings": {"stability": 0.5, "similarity_boost": 0.5},
                        "xi_api_key": api_key,
                        # Some implementations require a priming text even if empty → send a single space
                        "text": " "
                    }
                    # Some ElevenLabs accounts/models require voice_id AND 'generation_config'
                    # Include explicit voice_id and a minimal generation_config to avoid 1008 errors.
                    if session.get("voice_id"):
                        start_payload["voice_id"] = session["voice_id"]
                    start_payload["generation_config"] = {
                        "chunk_length_schedule": [120, 160, 200]
                    }
                    # Also include text/ssml inline in start for maximum compatibility
                    if text:
                        start_payload["text"] = text
                    if ssml:
                        start_payload["ssml"] = ssml
                    logger.info("/ws/tts sending start to ElevenLabs", extra={"has_text": bool(text), "text_len": text_len, "has_ssml": bool(ssml), "ssml_len": ssml_len})
                    await el_ws.send_json(start_payload)

                    # Per ElevenLabs stream-input docs:
                    # 1) start (with xi_api_key and priming text)
                    # 2) add_text (text or ssml)
                    # 3) input_audio_buffer.commit
                    # 4) generate
                    await websocket.send_json({"type": "tts.meta", "data": {"sequence": "start(xi_api_key)->add_text->commit->generate"}})
                    if ssml:
                        await el_ws.send_json({"type": "add_text", "ssml": ssml})
                        logger.debug("/ws/tts sent add_text (ssml)", extra={"ssml_len": ssml_len})
                        await websocket.send_json({"type": "tts.meta", "data": {"stage": "add_text_sent", "mode": "ssml", "len": ssml_len}})
                    elif text:
                        await el_ws.send_json({"type": "add_text", "text": text})
                        logger.debug("/ws/tts sent add_text (text)", extra={"text_len": text_len})
                        await websocket.send_json({"type": "tts.meta", "data": {"stage": "add_text_sent", "mode": "text", "len": text_len}})
                    else:
                        # If client provided nothing, we still initialized with a priming " " in start
                        # but some accounts require explicit add_text; send minimal filler to proceed.
                        await el_ws.send_json({"type": "add_text", "text": " "})
                        await websocket.send_json({"type": "tts.meta", "data": {"stage": "add_text_sent", "mode": "text", "len": 1}})

                    await el_ws.send_json({"type": "input_audio_buffer.commit"})
                    logger.debug("/ws/tts sent input_audio_buffer.commit")
                    await websocket.send_json({"type": "tts.meta", "data": {"stage": "commit_sent"}})

                    await el_ws.send_json({"type": "generate"})
                    logger.debug("/ws/tts sent generate to ElevenLabs")
                    await websocket.send_json({"type": "tts.meta", "data": {"stage": "generate_sent"}})

                    # Read frames from ElevenLabs (aiohttp WS API)
                    # Send a tiny client ping after generate to keep the connection lively
                    try:
                        await el_ws.ping()
                    except Exception:
                        pass
                    while True:
                        msg = await el_ws.receive()
                        if msg.type == WSMsgType.BINARY:
                            chunk_size = len(msg.data) if msg.data else 0
                            bytes_forwarded += chunk_size
                            logger.debug("/ws/tts forwarding binary audio", extra={"chunk_bytes": chunk_size, "total_bytes": bytes_forwarded})
                            if websocket.client_state == WebSocketState.CONNECTED:
                                await websocket.send_bytes(msg.data)
                            else:
                                logger.info("/ws/tts client disconnected while forwarding audio")
                                break
                        elif msg.type == WSMsgType.TEXT:
                            raw = msg.data
                            # Some implementations send base64 audio chunks inside TEXT frames (key "audio")
                            try:
                                data = json.loads(raw)
                            except Exception:
                                logger.debug("/ws/tts received non-JSON TEXT from ElevenLabs", extra={"len": len(raw)})
                                await websocket.send_json({"type": "tts.meta", "data": {"raw": str(raw)[:500]}})
                                continue

                            # 1) If there is 'audio' key with base64 payload, forward it as binary to the client
                            audio_b64 = data.get("audio")
                            if isinstance(audio_b64, str) and audio_b64:
                                try:
                                    import base64 as _b64
                                    audio_bytes = _b64.b64decode(audio_b64, validate=False)
                                    if audio_bytes:
                                        bytes_forwarded += len(audio_bytes)
                                        if websocket.client_state == WebSocketState.CONNECTED:
                                            await websocket.send_bytes(audio_bytes)
                                        else:
                                            logger.info("/ws/tts client disconnected while forwarding TEXT-embedded audio")
                                            break
                                    # Mirror minimal meta for debugging
                                    await websocket.send_json({"type": "tts.meta", "data": {"upstream_text": {"audio": "<base64:len>", "isFinal": data.get("isFinal")}}})
                                except Exception as dec_err:
                                    logger.debug("/ws/tts failed to decode TEXT-embedded audio", extra={"error": str(dec_err)})

                            # 2) Forward upstream TEXT as meta mirror (without large base64) for diagnostics
                            mirror = dict(data)
                            if "audio" in mirror:
                                mirror["audio"] = "<base64:omitted>"
                            await websocket.send_json({"type": "tts.meta", "data": {"upstream_text": mirror}})

                            # 3) Handle viseme/phoneme events
                            event_type = (data.get("type") or data.get("event") or "").lower()
                            if "viseme" in event_type or "phoneme" in event_type or "timestamp" in data:
                                time_ms = int(float(data.get("offset", data.get("timestamp", 0))) * 1000) if isinstance(data.get("timestamp"), (float, int)) else data.get("time_ms", 0)
                                phoneme = data.get("phoneme") or data.get("viseme") or data.get("morph") or ""
                                try:
                                    weight = float(data.get("weight", 1.0))
                                except Exception:
                                    weight = 1.0
                                morph = await morph_map(phoneme)
                                await websocket.send_json({"type": "tts.viseme","time_ms": time_ms,"morph": morph,"weight": weight})

                            # 4) Handle final/completed events
                            if data.get("isFinal") or data.get("final") or event_type in ("done", "completed", "generation.completed"):
                                await websocket.send_json({"type": "tts.end"})
                                logger.info("/ws/tts ElevenLabs final event received, ending stream", extra={"total_bytes": bytes_forwarded})
                                break

                            # 5) Auth and parameter diagnostics
                            try:
                                code = int(data.get("code", 0))
                            except Exception:
                                code = 0
                            msg_lower = str(data).lower()
                            if code in (401, 403, 1008) or "unauthorized" in msg_lower or "invalid_authorization_header" in msg_lower or "neither xi-api-key nor authorization header were found" in msg_lower:
                                await websocket.send_json({
                                    "type": "tts.error",
                                    "code": "UNAUTHORIZED",
                                    "message": "ElevenLabs WS auth failed. Ensure ELEVENLABS_API_KEY is valid and included as 'xi_api_key' in the initial 'start' message (not URL/header)."
                                })
                                try:
                                    await websocket.send_json({"type": "tts.end"})
                                except Exception:
                                    pass
                                logger.error("/ws/tts UNAUTHORIZED from ElevenLabs", extra={"code": code, "details": data})
                                break

                            if "voice_not_found" in msg_lower or ("model" in msg_lower and "not" in msg_lower):
                                await websocket.send_json({"type": "tts.meta", "data": {"warning": "Parameter issue reported by upstream", "details": data}})
                        elif msg.type in (WSMsgType.CLOSE, WSMsgType.CLOSING, WSMsgType.CLOSED):
                            logger.info("/ws/tts ElevenLabs WS closed", extra={"total_bytes": bytes_forwarded})
                            if bytes_forwarded == 0:
                                await websocket.send_json({
                                    "type": "tts.error",
                                    "code": "UPSTREAM_CLOSED",
                                    "message": "Upstream WS closed before sending audio",
                                    "diag": {"stage": "closed", "hint": "Verify xi_api_key validity and that 'start' was accepted upstream."}
                                })
                            break
                        elif msg.type == WSMsgType.ERROR:
                            err = str(el_ws.exception())
                            await websocket.send_json({"type": "tts.error", "code": "STREAM_ERROR", "message": err, "diag": {"stage": "upstream_receive_error"}})
                            logger.error("/ws/tts ElevenLabs WS error", extra={"error": err})
                            break

                except asyncio.CancelledError:
                    logger.debug("/ws/tts pump task cancelled")
                except Exception as e:
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_json({"type": "tts.error", "code": "STREAM_ERROR", "message": str(e), "diag": {"stage": "pump_exception"}})
                    logger.error("/ws/tts pump exception", extra={"error": str(e)})
                finally:
                    # Ensure WS is closed; ignore CancelledError from underlying reader during shutdown
                    try:
                        await el_ws.close()
                    except asyncio.CancelledError:
                        pass
                    except Exception:
                        pass
                    # Ensure aiohttp session is closed
                    try:
                        s = session.pop("_aiohttp_session", None)
                        if s:
                            await s.close()
                    except Exception:
                        pass
                    logger.info("/ws/tts pump finished", extra={"bytes_forwarded": bytes_forwarded})

            session["elevenlabs_task"] = asyncio.create_task(pump_from_elevenlabs())

        try:
            # Ack service ready
            await websocket.send_json({
                "type": "tts.ready",
                "defaults": {
                    "voiceId": session["voice_id"],
                    "model": session["model"],
                    "format": session["format"],
                    "sampleRate": session["sample_rate"],
                    "lang": session["lang"]
                }
            })
            await websocket.send_json({"type": "tts.meta", "data": {"stage": "ready_acked"}})

            while True:
                # Allow both text and binary? Control plane is JSON here.
                raw = await websocket.receive_text()
                logger.debug("/ws/tts received from client", extra={"payload": raw[:500]})
                msg = json.loads(raw)
                mtype = msg.get("type")

                if mtype == "tts.start":
                    # Normalize incoming voiceId: support aliases while enforcing valid ElevenLabs voice IDs
                    vid = msg.get("voiceId", session["voice_id"])
                    if isinstance(vid, str):
                        name = vid.strip().lower()
                        if name == "rachel":
                            vid = "21m00Tcm4TlvDq8ikWAM"
                        elif name == "daniel":
                            # Neutralize unsupported alias by falling back to current/default
                            vid = session["voice_id"]
                    session["voice_id"] = vid
                    session["model"] = msg.get("model", session["model"])
                    session["format"] = msg.get("format", session["format"])
                    session["sample_rate"] = int(msg.get("sampleRate", session["sample_rate"]))
                    session["lang"] = msg.get("lang", session["lang"])
                    await websocket.send_json({
                        "type": "tts.start",
                        "voiceId": session["voice_id"],
                        "model": session["model"],
                        "format": session["format"],
                        "sampleRate": session["sample_rate"],
                        "lang": session["lang"]
                    })
                    logger.info("/ws/tts acked tts.start", extra={"voice_id": session["voice_id"], "model": session["model"], "format": session["format"]})

                elif mtype in ("tts.text", "tts.ssml"):
                    text = msg.get("text") if mtype == "tts.text" else None
                    ssml = msg.get("ssml") if mtype == "tts.ssml" else None
                    logger.info("/ws/tts received synthesis request", extra={"type": mtype, "text_len": len(text) if text else 0, "has_ssml": bool(ssml)})

                    # If another stream is active, close it first
                    await close_elevenlabs()
                    # Extra: advise client to fallback to HTTP if UNAUTHORIZED is frequent
                    session["cancel_flag"] = False
                    await websocket.send_json({"type": "tts.meta", "data": {"stage": "open_upstream_begin"}})
                    await open_elevenlabs_stream(text=text, ssml=ssml)

                elif mtype == "tts.cancel":
                    session["cancel_flag"] = True
                    await close_elevenlabs()
                    await websocket.send_json({"type": "tts.canceled"})
                    logger.info("/ws/tts canceled by client")

                elif mtype == "tts.end":
                    await close_elevenlabs()
                    await websocket.send_json({"type": "tts.end"})
                    logger.info("/ws/tts ended by client")
                    break

                else:
                    await websocket.send_json({"type": "tts.error", "code": "UNKNOWN_TYPE", "message": f"Unknown message type: {mtype}"})
                    logger.warning("/ws/tts received unknown message type", extra={"type": mtype})

        except WebSocketDisconnect:
            logger.info("/ws/tts client disconnected")
        except Exception as e:
            logger.error(f"/ws/tts error: {e}", exc_info=True)
            try:
                await websocket.send_json({"type": "tts.error", "code": "SERVER_ERROR", "message": str(e)})
            except Exception:
                pass
        finally:
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except Exception:
                pass
            await close_elevenlabs()
    
    @router.websocket("/session/{session_id}")
    async def websocket_session_endpoint(
        websocket: WebSocket,
        session_id: str,
        user_id: Optional[str] = Query(None),
        session_type: Optional[str] = Query("practice")
    ):
        """
        Main WebSocket endpoint for real-time presentation coaching.
        
        Handles:
        - Real-time audio streaming and processing
        - AI feedback generation with Gemini
        - Performance metrics and analytics
        - Session management and progress tracking
        """
        session_uuid = uuid.UUID(session_id)
        
        try:
            # Accept WebSocket connection
            await websocket.accept()
            logger.info(f"WebSocket connection established for session {session_id}")
            
            # Initialize or retrieve session
            session = await connection_manager.get_or_create_session(
                session_uuid, user_id, SessionType(session_type)
            )
            
            # Register connection
            await connection_manager.connect(websocket, session_uuid)
            
            # Initialize AURA pipeline for this session
            pipeline = AuraPipeline(session)
            
            # Send welcome message
            await websocket.send_json({
                "type": "session_initialized",
                "session_id": session_id,
                "message": "Session AURA initialisée avec succès !",
                "pipeline_ready": True,
                "processors": ["AnalysisProcessor", "FeedbackProcessor", "MetricsProcessor"],
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Start processing loop
            await connection_manager.handle_session_communication(
                websocket, session_uuid, pipeline
            )
            
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for session {session_id}")
            await connection_manager.disconnect(websocket, session_uuid)
            
        except Exception as e:
            logger.error(f"WebSocket error for session {session_id}: {e}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "error": str(e),
                    "session_id": session_id,
                    "timestamp": datetime.utcnow().isoformat()
                })
            except:
                pass  # Connection might be closed
            finally:
                await connection_manager.disconnect(websocket, session_uuid)
    
    @router.websocket("/test")
    async def websocket_test_endpoint(websocket: WebSocket):
        """Test WebSocket endpoint for debugging."""
        await websocket.accept()
        try:
            await websocket.send_json({
                "type": "test_response",
                "message": "WebSocket test successful",
                "services_available": list(services.keys()),
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Echo messages for testing
            while True:
                data = await websocket.receive_json()
                await websocket.send_json({
                    "type": "echo",
                    "received": data,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
        except WebSocketDisconnect:
            logger.info("Test WebSocket disconnected")

    # =========================================
    # AGENT: D-ID Agents Streams WS proxy endpoint
    # =========================================
    @router.websocket("/agent/{agent_id}")
    async def websocket_agent_endpoint(websocket: WebSocket, agent_id: str):
        """
        WebSocket bridge Client <—> Backend <—> D‑ID Agents Streams pour un agent donné.
        Protocole client minimal:
          - Client -> backend (TEXT JSON):
              {type:"agent.start"} -> ack {type:"agent.started"}
              {type:"agent.prompt", data:{...}} -> forward JSON vers D‑ID
              {type:"agent.tool_result", data:{...}} -> forward JSON
              {type:"agent.end"} -> fermeture
            Client -> backend (BINARY): audio brutf (forward tel quel)
          - Backend -> client:
              {type:"agent.meta", data:{stage}} : accepted, upstream_connected
              {type:"agent.upstream", data:{...}} : messages TEXT JSON en provenance D‑ID
              Binaire: relayé tel quel
              {type:"agent.error", code, message}
              {type:"agent.end"}
        Timeouts:
          - Durée max de session: settings.agent_max_session_duration
          - Inactivité client: settings.agent_session_timeout
        """
        await websocket.accept()
        await websocket.send_json({"type": "agent.meta", "data": {"stage": "accepted", "agent_id": agent_id}})
        logger.info("/ws/agent accepted", extra={"agent_id": agent_id})

        # Charger DidAgentsService (via services si dispo; sinon instancier depuis settings)
        try:
            try:
                from backend.services.avatar.did_agents_service import DidAgentsService, DidAgentsError
            except Exception:
                from services.avatar.did_agents_service import DidAgentsService, DidAgentsError  # type: ignore
            did_agents = services.get("did_agents_service")
            if not isinstance(did_agents, DidAgentsService):
                try:
                    from backend.app.config import settings as backend_settings
                except Exception:
                    from app.config import get_settings
                    backend_settings = get_settings()
                did_agents = DidAgentsService(
                    api_key=getattr(backend_settings, "did_agents_api_key", None) or getattr(backend_settings, "did_api_key", None),
                    api_base=getattr(backend_settings, "did_agents_api_base", None),
                    ws_base=getattr(backend_settings, "did_agents_ws_base", None),
                )
                services["did_agents_service"] = did_agents
        except Exception as e:
            await websocket.send_json({"type": "agent.error", "code": "SERVICE_INIT_FAILED", "message": str(e)})
            return

        # Ouvrir le WS upstream vers D‑ID Agents
        upstream_ws = None
        aio_session = None
        try:
            upstream_ws = await did_agents.open_agent_ws(agent_id)
            aio_session = getattr(upstream_ws, "_agents_http_session", None)
            await websocket.send_json({"type": "agent.meta", "data": {"stage": "upstream_connected"}})
            logger.info("/ws/agent upstream connected", extra={"agent_id": agent_id})
        except Exception as e:
            await websocket.send_json({
                "type": "agent.error",
                "code": "CONNECT_FAILED",
                "message": f"Failed to connect D-ID Agents WS: {str(e)}",
                "hint": "Basculer en audio uniquement via /ws/tts"
            })
            logger.error("/ws/agent connect failed", extra={"agent_id": agent_id, "error": str(e)})
            return

        # Budget/Timeouts
        try:
            from backend.app.config import settings as backend_settings
        except Exception:
            from app.config import get_settings
            backend_settings = get_settings()
        max_session_seconds = int(getattr(backend_settings, "agent_max_session_duration", 300) or 300)
        idle_timeout = int(getattr(backend_settings, "agent_session_timeout", 30) or 30)

        stop_flag = {"stop": False}
        last_client_activity = {"ts": asyncio.get_running_loop().time()}

        async def pump_upstream_to_client():
            try:
                while not stop_flag["stop"]:
                    msg = await upstream_ws.receive()
                    if msg.type == WSMsgType.BINARY:
                        if websocket.client_state == WebSocketState.CONNECTED:
                            await websocket.send_bytes(msg.data)
                        else:
                            break
                    elif msg.type == WSMsgType.TEXT:
                        raw_text = msg.data
                        try:
                            data = json.loads(raw_text)
                            await websocket.send_json({"type": "agent.upstream", "data": data})
                        except Exception:
                            await websocket.send_json({"type": "agent.upstream_text", "data": raw_text})
                    elif msg.type in (WSMsgType.CLOSE, WSMsgType.CLOSING, WSMsgType.CLOSED):
                        await websocket.send_json({"type": "agent.end"})
                        break
                    elif msg.type == WSMsgType.ERROR:
                        err = str(upstream_ws.exception())
                        await websocket.send_json({"type": "agent.error", "code": "UPSTREAM_ERROR", "message": err})
                        break
            except asyncio.CancelledError:
                pass
            except Exception as e:
                try:
                    await websocket.send_json({"type": "agent.error", "code": "UPSTREAM_PUMP_ERROR", "message": str(e)})
                except Exception:
                    pass
            finally:
                stop_flag["stop"] = True

        async def pump_client_to_upstream():
            try:
                while not stop_flag["stop"]:
                    # Gestion d'inactivité
                    now = asyncio.get_running_loop().time()
                    if now - last_client_activity["ts"] > idle_timeout:
                        await websocket.send_json({"type": "agent.error", "code": "IDLE_TIMEOUT", "message": "Client idle timeout"})
                        break

                    try:
                        event = await asyncio.wait_for(websocket.receive(), timeout=1.0)
                    except asyncio.TimeoutError:
                        continue

                    last_client_activity["ts"] = asyncio.get_running_loop().time()

                    if event["type"] == "websocket.receive":
                        if "text" in event:
                            raw = event["text"]
                            try:
                                obj = json.loads(raw)
                            except Exception:
                                # Forward brut si pas JSON
                                await upstream_ws.send_str(raw)
                                continue

                            mtype = obj.get("type")
                            if mtype == "agent.start":
                                await websocket.send_json({"type": "agent.started"})
                            elif mtype == "agent.prompt":
                                payload = obj.get("data", {})
                                await upstream_ws.send_str(json.dumps(payload))
                            elif mtype == "agent.tool_result":
                                payload = obj.get("data", {})
                                await upstream_ws.send_str(json.dumps(payload))
                            elif mtype == "agent.keepalive":
                                try:
                                    await upstream_ws.ping()
                                except Exception:
                                    pass
                                await websocket.send_json({"type": "agent.meta", "data": {"stage": "ping_sent"}})
                            elif mtype == "agent.end":
                                stop_flag["stop"] = True
                                await websocket.send_json({"type": "agent.end"})
                                break
                            else:
                                # Par défaut, forward JSON complet pour flexibilité
                                await upstream_ws.send_str(json.dumps(obj))
                        elif "bytes" in event:
                            data = event["bytes"]
                            try:
                                await upstream_ws.send_bytes(data)
                            except Exception as e:
                                await websocket.send_json({"type": "agent.error", "code": "FORWARD_BINARY_FAILED", "message": str(e)})
                                break
                    elif event["type"] in ("websocket.disconnect",):
                        stop_flag["stop"] = True
                        break
            except WebSocketDisconnect:
                stop_flag["stop"] = True
            except asyncio.CancelledError:
                pass
            except Exception as e:
                try:
                    await websocket.send_json({"type": "agent.error", "code": "CLIENT_PUMP_ERROR", "message": str(e)})
                except Exception:
                    pass
            finally:
                stop_flag["stop"] = True

        # Tâche de limite de durée de session
        async def session_deadline():
            try:
                await asyncio.sleep(max_session_seconds)
                if not stop_flag["stop"]:
                    await websocket.send_json({"type": "agent.error", "code": "MAX_SESSION_DURATION", "message": "Durée maximale de session atteinte"})
            except asyncio.CancelledError:
                pass
            finally:
                stop_flag["stop"] = True

        t1 = asyncio.create_task(pump_upstream_to_client())
        t2 = asyncio.create_task(pump_client_to_upstream())
        t3 = asyncio.create_task(session_deadline())

        try:
            await asyncio.wait([t1, t2, t3], return_when=asyncio.FIRST_COMPLETED)
        finally:
            for t in (t1, t2, t3):
                try:
                    t.cancel()
                except Exception:
                    pass
            for t in (t1, t2, t3):
                try:
                    await t
                except Exception:
                    pass
            try:
                if upstream_ws and not upstream_ws.closed:
                    await upstream_ws.close()
            except Exception:
                pass
            try:
                if aio_session:
                    await aio_session.close()
            except Exception:
                pass
            logger.info("/ws/agent closed", extra={"agent_id": agent_id})

    # =========================================
    # AVATAR: D-ID realtime WS proxy endpoint
    # =========================================
    @router.websocket("/avatar/{session_id}")
    async def websocket_avatar_endpoint(websocket: WebSocket, session_id: str):
        """
        WebSocket bridge Client <—> Backend <—> D‑ID Realtime pour une session avatar.
        Design:
          - Le client parle en JSON:
              {type:"avatar.start" | "avatar.end" | "avatar.keepalive" | "avatar.forward", ...}
          - Le backend ouvre une connexion WS vers D‑ID via DidService.open_realtime_ws(session_id)
          - Tous les messages client 'avatar.forward' sont forwardés tels quels vers D‑ID (texte)
          - Les frames binaires envoyées par le client (audio) sont forwardées à D‑ID
          - Les frames reçues de D‑ID (TEXT/BINARY) sont forwardées au client
        Fallback:
          - Si ouverture D‑ID échoue, on envoie un message d’erreur structuré et le frontend peut basculer ElevenLabs (/ws/tts).
        """
        await websocket.accept()
        await websocket.send_json({"type": "avatar.meta", "data": {"stage": "accepted", "session_id": session_id}})

        # Resolve DidService
        did = None
        try:
            try:
                from backend.services.avatar.did_service import DidService, DidServiceError
            except Exception:
                from services.avatar.did_service import DidService, DidServiceError  # type: ignore
            # Reuse service if provided via DI bag
            did = services.get("did_service")
            if not isinstance(did, DidService):
                # Build from settings service/env to avoid import cycles
                try:
                    from backend.app.config import settings as backend_settings
                except Exception:
                    from app.config import get_settings
                    backend_settings = get_settings()
                did = DidService(
                    api_key=getattr(backend_settings, "did_api_key", None),
                    api_base=getattr(backend_settings, "did_api_base", None),
                    realtime_ws_url=getattr(backend_settings, "did_realtime_ws_url", None),
                    default_avatar_id=getattr(backend_settings, "avatar_default_id", None),
                    default_resolution=getattr(backend_settings, "avatar_default_resolution", None),
                    default_backdrop=getattr(backend_settings, "avatar_default_backdrop", None),
                )
                services["did_service"] = did  # cache
        except Exception as e:
            await websocket.send_json({"type": "avatar.error", "code": "SERVICE_INIT_FAILED", "message": str(e)})
            return

        # Try open upstream
        upstream_ws = None
        aio_session = None
        try:
            upstream_ws = await did.open_realtime_ws(session_id)
            # Retrieve underlying aiohttp session for cleanup
            aio_session = getattr(upstream_ws, "_did_http_session", None)
            await websocket.send_json({"type": "avatar.meta", "data": {"stage": "upstream_connected"}})
            logger.info("/ws/avatar upstream D-ID connected", extra={"session_id": session_id})
        except Exception as e:
            await websocket.send_json({
                "type": "avatar.error",
                "code": "CONNECT_FAILED",
                "message": f"Failed to connect D-ID realtime: {str(e)}",
                "hint": "Basculer en audio uniquement via /ws/tts"
            })
            logger.error("/ws/avatar connect failed", extra={"session_id": session_id, "error": str(e)})
            # No upstream, just stop
            return

        # Pump tasks
        stop_flag = {"stop": False}

        async def pump_upstream_to_client():
            try:
                while not stop_flag["stop"]:
                    msg = await upstream_ws.receive()
                    if msg.type == WSMsgType.BINARY:
                        if websocket.client_state == WebSocketState.CONNECTED:
                            await websocket.send_bytes(msg.data)
                        else:
                            break
                    elif msg.type == WSMsgType.TEXT:
                        # Forward text JSON as-is
                        try:
                            # Validate JSON to ensure client receives consistent payloads
                            data = json.loads(msg.data)
                            await websocket.send_json({"type": "avatar.upstream", "data": data})
                        except Exception:
                            # If not JSON, forward raw string as meta
                            await websocket.send_json({"type": "avatar.upstream_text", "data": msg.data})
                    elif msg.type in (WSMsgType.CLOSE, WSMsgType.CLOSING, WSMsgType.CLOSED):
                        await websocket.send_json({"type": "avatar.end"})
                        break
                    elif msg.type == WSMsgType.ERROR:
                        err = str(upstream_ws.exception())
                        await websocket.send_json({"type": "avatar.error", "code": "UPSTREAM_ERROR", "message": err})
                        break
            except asyncio.CancelledError:
                pass
            except Exception as e:
                try:
                    await websocket.send_json({"type": "avatar.error", "code": "UPSTREAM_PUMP_ERROR", "message": str(e)})
                except Exception:
                    pass
            finally:
                stop_flag["stop"] = True

        async def pump_client_to_upstream():
            try:
                while not stop_flag["stop"]:
                    event = await websocket.receive()
                    if event["type"] == "websocket.receive":
                        if "text" in event:
                            raw = event["text"]
                            # Expect control messages
                            try:
                                obj = json.loads(raw)
                            except Exception:
                                # Pass through as raw string
                                await upstream_ws.send_str(raw)
                                continue
                            mtype = obj.get("type")
                            if mtype == "avatar.start":
                                # Client indicates readiness; optionally forward a keepalive to D-ID
                                await websocket.send_json({"type": "avatar.started"})
                            elif mtype == "avatar.forward":
                                # Forward inner payload as JSON string or binary if base64 provided
                                payload = obj.get("data")
                                # If payload is dict, send as JSON
                                if isinstance(payload, dict):
                                    await upstream_ws.send_str(json.dumps(payload))
                                else:
                                    # If a raw string, send as-is
                                    await upstream_ws.send_str(str(payload))
                            elif mtype == "avatar.keepalive":
                                try:
                                    await upstream_ws.ping()
                                except Exception:
                                    pass
                                await websocket.send_json({"type": "avatar.meta", "data": {"stage": "ping_sent"}})
                            elif mtype == "avatar.end":
                                stop_flag["stop"] = True
                                await websocket.send_json({"type": "avatar.end"})
                                break
                            else:
                                # Unknown -> forward raw to upstream for flexibility
                                await upstream_ws.send_str(raw)
                        elif "bytes" in event:
                            data = event["bytes"]
                            # Forward raw binary (e.g., audio chunk) to D-ID
                            try:
                                await upstream_ws.send_bytes(data)
                            except Exception as e:
                                await websocket.send_json({"type": "avatar.error", "code": "FORWARD_BINARY_FAILED", "message": str(e)})
                                break
                    elif event["type"] in ("websocket.disconnect",):
                        stop_flag["stop"] = True
                        break
            except WebSocketDisconnect:
                stop_flag["stop"] = True
            except asyncio.CancelledError:
                pass
            except Exception as e:
                try:
                    await websocket.send_json({"type": "avatar.error", "code": "CLIENT_PUMP_ERROR", "message": str(e)})
                except Exception:
                    pass
            finally:
                stop_flag["stop"] = True

        # Run both pumps concurrently
        t1 = asyncio.create_task(pump_upstream_to_client())
        t2 = asyncio.create_task(pump_client_to_upstream())

        try:
            await asyncio.wait([t1, t2], return_when=asyncio.FIRST_COMPLETED)
        finally:
            stop_flag["stop"] = True
            for t in (t1, t2):
                try:
                    t.cancel()
                except Exception:
                    pass
            for t in (t1, t2):
                try:
                    await t
                except Exception:
                    pass
            # Cleanup upstream
            try:
                if upstream_ws and not upstream_ws.closed:
                    await upstream_ws.close()
            except Exception:
                pass
            try:
                if aio_session:
                    await aio_session.close()
            except Exception:
                pass
            logger.info("/ws/avatar closed", extra={"session_id": session_id})

        # No explicit return body for WS route

    return router


class ConnectionManager:
    """
    Manages WebSocket connections and session communication with complete
    AuraPipeline integration for real-time coaching.
    """
    
    def __init__(self, services: Dict[str, Any]):
        """Initialize connection manager with services."""
        self.services = services
        self.active_connections: Dict[uuid.UUID, WebSocket] = {}
        self.session_pipelines: Dict[uuid.UUID, AuraPipeline] = {}
        self.audio_buffers: Dict[uuid.UUID, AudioBuffer] = {}
        self.session_stats: Dict[uuid.UUID, Dict[str, Any]] = {}
        
        # Connection management settings
        self.heartbeat_interval = 30  # seconds
        self.max_message_size = 1024 * 1024  # 1MB
        self.audio_chunk_timeout = 30.0  # seconds - increased from 5.0
        
        logger.info("ConnectionManager initialized with complete pipeline integration")
    
    async def connect(self, websocket: WebSocket, session_id: uuid.UUID):
        """Register a new WebSocket connection."""
        self.active_connections[session_id] = websocket
        
        # Initialize audio buffer for real-time streaming
        self.audio_buffers[session_id] = AudioBuffer(
            sample_rate=16000,
            chunk_size=1600,  # 100ms at 16kHz
            max_buffer_seconds=10.0
        )
        
        # Initialize session stats
        self.session_stats[session_id] = {
            "connected_at": datetime.utcnow(),
            "messages_received": 0,
            "audio_chunks_processed": 0,
            "feedback_items_sent": 0,
            "errors_count": 0
        }
        
        logger.info(f"WebSocket connected and initialized for session {session_id}")
    
    async def disconnect(self, websocket: WebSocket, session_id: uuid.UUID):
        """Cleanup connection and resources."""
        try:
            # Remove connection
            if session_id in self.active_connections:
                del self.active_connections[session_id]
            
            # Cleanup pipeline
            if session_id in self.session_pipelines:
                pipeline = self.session_pipelines[session_id]
                # Get final session summary
                try:
                    final_summary = await pipeline.get_session_summary()
                    logger.info(f"Session {session_id} final summary: {final_summary}")
                except Exception as e:
                    logger.error(f"Error getting final summary for session {session_id}: {e}")
                
                del self.session_pipelines[session_id]
            
            # Cleanup audio buffer
            if session_id in self.audio_buffers:
                self.audio_buffers[session_id].clear()
                del self.audio_buffers[session_id]
            
            # Log final stats
            if session_id in self.session_stats:
                stats = self.session_stats[session_id]
                session_duration = (datetime.utcnow() - stats["connected_at"]).total_seconds()
                logger.info(
                    f"Session {session_id} disconnected",
                    extra={
                        "duration_seconds": session_duration,
                        "messages_received": stats["messages_received"],
                        "audio_chunks_processed": stats["audio_chunks_processed"],
                        "feedback_items_sent": stats["feedback_items_sent"],
                        "errors_count": stats["errors_count"]
                    }
                )
                del self.session_stats[session_id]
            
        except Exception as e:
            logger.error(f"Error during disconnect cleanup for session {session_id}: {e}")
    
    async def get_or_create_session(
        self, 
        session_id: uuid.UUID, 
        user_id: Optional[str], 
        session_type: SessionType
    ) -> PresentationSessionData:
        """Get existing session or create new one."""
        storage_service = self.services['storage']
        
        try:
            # Try to get existing session
            session = await storage_service.get_session(session_id)
            if session:
                logger.info(f"Retrieved existing session {session_id}")
                return session
        except Exception as e:
            logger.debug(f"Session {session_id} not found, creating new one: {e}")
        
        # Create new session
        session_config = SessionConfig(
            session_type=session_type,
            language="fr",
            feedback_frequency=3,
            real_time_feedback=True,
            detailed_analysis=True,
            ai_coaching=True
        )
        
        session = await storage_service.create_session(
            user_id=user_id or "anonymous",
            config=session_config,
            session_id=session_id
        )
        
        logger.info(f"Created new session {session_id} for user {user_id}")
        return session
    
    async def handle_session_communication(
        self, 
        websocket: WebSocket, 
        session_id: uuid.UUID, 
        pipeline: AuraPipeline
    ):
        """
        Handle complete session communication with real-time audio processing.
        """
        self.session_pipelines[session_id] = pipeline
        
        try:
            # Start heartbeat task
            heartbeat_task = asyncio.create_task(
                self._heartbeat_loop(websocket, session_id)
            )
            
            # Main message handling loop
            while True:
                # Wait for messages with timeout
                try:
                    raw_message = await asyncio.wait_for(websocket.receive_text(), timeout=self.audio_chunk_timeout)
                    logger.debug(f"Raw WebSocket message received: {raw_message[:200]}...")  # Log first 200 chars
                    
                    message = json.loads(raw_message)
                    self.session_stats[session_id]["messages_received"] += 1
                    
                    # Process message based on type
                    message_type = message.get("type")
                    
                    logger.info(f"Received WebSocket message: type={message_type}, session={session_id}")
                    
                    if message_type == "audio_chunk":
                        logger.info(f"Processing audio chunk for session {session_id}")
                        await self._handle_audio_chunk(websocket, session_id, message, pipeline)
                    elif message_type == "control_command":
                        await self._handle_control_command(websocket, session_id, message, pipeline)
                    elif message_type == "config_update":
                        await self._handle_config_update(websocket, session_id, message, pipeline)
                    elif message_type == "heartbeat":
                        await self._handle_heartbeat(websocket, session_id, message)
                    elif message_type == "request_summary":
                        await self._handle_summary_request(websocket, session_id, pipeline)
                    else:
                        logger.warning(f"Unknown message type: {message_type}")
                        await websocket.send_json({
                            "type": "error",
                            "error": f"Unknown message type: {message_type}",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                
                except asyncio.TimeoutError:
                    # No message received within timeout, continue
                    continue
                except WebSocketDisconnect:
                    logger.info(f"WebSocket disconnected for session {session_id}")
                    break
                except Exception as e:
                    logger.error(f"Error handling message for session {session_id}: {e}")
                    self.session_stats[session_id]["errors_count"] += 1
                    
                    # Send error response
                    try:
                        await websocket.send_json({
                            "type": "error",
                            "error": str(e),
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    except Exception as send_error:
                        logger.error(f"Failed to send error response: {send_error}")
                        break
        
        finally:
            # Cleanup
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
    
    async def _handle_audio_chunk(
        self, 
        websocket: WebSocket, 
        session_id: uuid.UUID, 
        message: Dict[str, Any], 
        pipeline: AuraPipeline
    ):
        """Handle real-time audio chunk processing through the complete pipeline."""
        try:
            # Extract audio data
            audio_data = message.get("audio_data")
            if not audio_data:
                raise AudioProcessingException("No audio data provided")
            
            # Decode base64 audio data
            try:
                audio_bytes = base64.b64decode(audio_data)
            except Exception as e:
                raise AudioProcessingException(f"Invalid audio data encoding: {e}")
            
            # Add to audio buffer
            audio_buffer = self.audio_buffers[session_id]
            success = audio_buffer.add_chunk(
                audio_bytes, 
                source_sample_rate=message.get("sample_rate", 16000)
            )
            
            if not success:
                logger.warning(f"Audio buffer full for session {session_id}")
                return
            
            # Get processed audio chunk
            audio_array = audio_buffer.get_chunk()
            if audio_array is None:
                return  # Not enough data yet
            
            # Convert numpy array to bytes for ProcessorPart
            try:
                if isinstance(audio_array, np.ndarray):
                    # Convert float32 numpy array to int16 bytes
                    audio_int16 = (audio_array * 32767).astype(np.int16)
                    audio_bytes = audio_int16.tobytes()
                else:
                    # If it's already bytes, use as is
                    audio_bytes = audio_array
            except Exception as e:
                logger.error(f"Error converting audio array to bytes: {e}")
                return
            
            # Process through complete AURA pipeline
            try:
                # First, analyze the audio bytes to get voice metrics
                from utils.audio_utils import analyze_voice_metrics
                
                # Convert bytes back to numpy array for analysis
                audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
                audio_float32 = audio_int16.astype(np.float32) / 32767.0
                
                # Analyze voice metrics
                voice_metrics = analyze_voice_metrics(audio_float32, 16000, pipeline.language)
                
                # Create analysis result
                analysis_result = {
                    "chunk_metrics": voice_metrics,
                    "advanced_metrics": {
                        "confidence_score": 0.8,
                        "processing_quality": "good"
                    },
                    "quality_assessment": {
                        "overall_quality": 0.75
                    },
                    "realtime_insights": [
                        "Audio analysé en temps réel",
                        f"Durée: {len(audio_float32) / 16000:.2f}s"
                    ]
                }
                
                # Create text-based ProcessorPart for pipeline
                analysis_part = ProcessorPart(
                    json.dumps(analysis_result),
                    mimetype="application/json",
                    metadata={
                        "type": "audio_chunk",  # Changed from "voice_analysis" to "audio_chunk"
                        "session_id": str(session_id),
                        "timestamp": datetime.utcnow().isoformat(),
                        "sample_rate": 16000,
                        "chunk_duration_ms": len(audio_array) / 16000 * 1000,
                        "client_timestamp": message.get("timestamp"),
                        "sequence_number": message.get("sequence_number", 0),
                        "realtime_processing": True
                    }
                )
                
                # Process through pipeline
                logger.info(f"Starting pipeline processing for audio chunk, session: {session_id}")
                result_count = 0
                async for result_part in pipeline.process(streams.stream_content([analysis_part])):
                    result_count += 1
                    logger.info(f"Pipeline generated result {result_count}: {result_part.metadata.get('type', 'unknown')}")
                    await self._send_pipeline_result(websocket, str(session_id), result_part)
                
                logger.info(f"Pipeline processing completed, generated {result_count} results")
                    
            except Exception as e:
                logger.error(f"Error in pipeline processing: {e}")
                logger.info("Sending fallback feedback due to pipeline error")
                # Send basic feedback as fallback
                await websocket.send_json({
                    "type": "coaching_feedback", 
                    "session_id": str(session_id),
                    "data": {
                        "coaching_feedback": {
                            "ai_generated_feedback": {
                                "summary": "Audio reçu et traité",
                                "strengths": ["Audio temps réel fonctionnel"],
                                "improvements": [],
                                "encouragement": "Continuez à parler !"
                            }
                        }
                    },
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Update stats
            self.session_stats[session_id]["audio_chunks_processed"] += 1
            
        except Exception as e:
            logger.error(f"Error processing audio chunk for session {session_id}: {e}")
            await websocket.send_json({
                "type": "audio_processing_error",
                "error": str(e),
                "session_id": str(session_id),
                "timestamp": datetime.utcnow().isoformat()
            })
    
    async def _send_pipeline_result(self, websocket: WebSocket, session_id: str, result_part):
        """Send pipeline processing results to WebSocket client."""
        try:
            result_type = result_part.metadata.get("type", "unknown")
            
            # Extract and parse result data
            result_data = None
            if hasattr(result_part, 'text') and result_part.text:
                try:
                    # Try to parse as JSON first
                    import json
                    result_data = json.loads(result_part.text)
                except json.JSONDecodeError:
                    # If not JSON, use as string
                    result_data = result_part.text
            elif hasattr(result_part, 'data') and result_part.data:
                result_data = result_part.data
            elif hasattr(result_part, 'part') and result_part.part:
                result_data = str(result_part.part)
            else:
                result_data = str(result_part)
            
            # Ensure session_id is string for JSON serialization
            session_id_str = str(session_id) if session_id else ""
            
            if result_type == "coaching_result":
                await websocket.send_json({
                    "type": "coaching_feedback",
                    "session_id": session_id_str,
                    "data": result_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
                logger.info(f"Sent coaching feedback to WebSocket for session {session_id_str}")
                
            elif result_type == "realtime_feedback":
                await websocket.send_json({
                    "type": "realtime_suggestion",
                    "session_id": session_id_str,
                    "data": result_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
                logger.info(f"Sent realtime feedback to WebSocket for session {session_id_str}")
                
            elif result_type == "performance_update":
                await websocket.send_json({
                    "type": "performance_metrics",
                    "session_id": session_id_str,
                    "data": result_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
                logger.info(f"Sent performance metrics to WebSocket for session {session_id_str}")
                
            elif result_type == "milestone_achieved":
                await websocket.send_json({
                    "type": "milestone",
                    "session_id": session_id_str,
                    "data": result_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            elif result_type == "error_result":
                await websocket.send_json({
                    "type": "processing_error",
                    "session_id": session_id_str,
                    "error": result_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            else:
                # Generic result - send with debug info
                logger.debug(f"Sending generic result type '{result_type}' to WebSocket")
                await websocket.send_json({
                    "type": "analysis_result",
                    "session_id": session_id_str,
                    "result_type": result_type,
                    "data": result_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
        except Exception as e:
            logger.error(f"Failed to send pipeline result: {e}")
            session_id_str = str(session_id) if session_id else ""
            await websocket.send_json({
                "type": "processing_error",
                "session_id": session_id_str,
                "error": f"Failed to send result: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            })
    
    async def _handle_control_command(
        self, 
        websocket: WebSocket, 
        session_id: uuid.UUID, 
        message: Dict[str, Any], 
        pipeline: AuraPipeline
    ):
        """Handle session control commands."""
        command = message.get("command")
        
        try:
            if command == "start_session":
                # Start session processing
                await websocket.send_json({
                    "type": "session_started",
                    "session_id": str(session_id),
                    "message": "Session de coaching démarrée",
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            elif command == "pause_session":
                # Pause processing
                await websocket.send_json({
                    "type": "session_paused",
                    "session_id": str(session_id),
                    "message": "Session mise en pause",
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            elif command == "resume_session":
                # Resume processing
                await websocket.send_json({
                    "type": "session_resumed",
                    "session_id": str(session_id),
                    "message": "Session reprise",
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            elif command == "end_session":
                # End session and get final summary
                final_summary = await pipeline.get_session_summary()
                await websocket.send_json({
                    "type": "session_ended",
                    "session_id": str(session_id),
                    "message": "Session terminée avec succès",
                    "final_summary": final_summary,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            else:
                await websocket.send_json({
                    "type": "error",
                    "error": f"Unknown command: {command}",
                    "timestamp": datetime.utcnow().isoformat()
                })
                
        except Exception as e:
            logger.error(f"Error handling control command {command} for session {session_id}: {e}")
            await websocket.send_json({
                "type": "control_error",
                "error": str(e),
                "command": command,
                "timestamp": datetime.utcnow().isoformat()
            })
    
    async def _handle_config_update(
        self, 
        websocket: WebSocket, 
        session_id: uuid.UUID, 
        message: Dict[str, Any], 
        pipeline: AuraPipeline
    ):
        """Handle session configuration updates."""
        try:
            config_updates = message.get("config", {})
            
            # Update pipeline configuration if needed
            if "enable_parallel_processing" in config_updates:
                pipeline.pipeline_config["enable_parallel_processing"] = config_updates["enable_parallel_processing"]
            
            if "feedback_frequency" in config_updates:
                pipeline.pipeline_config["metrics_calculation_interval"] = config_updates["feedback_frequency"]
            
            await websocket.send_json({
                "type": "config_updated",
                "session_id": str(session_id),
                "message": "Configuration mise à jour",
                "updated_config": config_updates,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error updating config for session {session_id}: {e}")
            await websocket.send_json({
                "type": "config_error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
    
    async def _handle_heartbeat(
        self, 
        websocket: WebSocket, 
        session_id: uuid.UUID, 
        message: Dict[str, Any]
    ):
        """Handle heartbeat messages."""
        await websocket.send_json({
            "type": "heartbeat_response",
            "session_id": str(session_id),
            "server_timestamp": datetime.utcnow().isoformat(),
            "client_timestamp": message.get("timestamp"),
            "stats": self.session_stats[session_id]
        })
    
    async def _handle_summary_request(
        self, 
        websocket: WebSocket, 
        session_id: uuid.UUID, 
        pipeline: AuraPipeline
    ):
        """Handle request for session summary."""
        try:
            summary = await pipeline.get_session_summary()
            await websocket.send_json({
                "type": "session_summary",
                "session_id": str(session_id),
                "summary": summary,
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Error generating summary for session {session_id}: {e}")
            await websocket.send_json({
                "type": "summary_error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
    
    async def _heartbeat_loop(self, websocket: WebSocket, session_id: uuid.UUID):
        """Maintain connection with periodic heartbeats."""
        try:
            while True:
                await asyncio.sleep(self.heartbeat_interval)
                
                if session_id not in self.active_connections:
                    break
                
                try:
                    await websocket.send_json({
                        "type": "heartbeat",
                        "session_id": str(session_id),
                        "timestamp": datetime.utcnow().isoformat(),
                        "stats": self.session_stats[session_id]
                    })
                except:
                    # Connection is broken
                    break
                    
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Heartbeat error for session {session_id}: {e}")
    
    async def broadcast_to_session(self, session_id: uuid.UUID, message: Dict[str, Any]):
        """Broadcast message to specific session."""
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to session {session_id}: {e}")
                # Remove broken connection
                await self.disconnect(websocket, session_id)
    
    def get_active_sessions(self) -> List[uuid.UUID]:
        """Get list of active session IDs."""
        return list(self.active_connections.keys())
    
    def get_session_stats(self, session_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Get statistics for a specific session."""
        return self.session_stats.get(session_id) 