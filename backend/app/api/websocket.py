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
        session = {
            "voice_id": services.get("settings").elevenlabs_default_voice_id if "settings" in services else os.getenv("ELEVENLABS_DEFAULT_VOICE_ID", "Rachel"),
            "model": services.get("settings").elevenlabs_model if "settings" in services else os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
            "format": "mp3_44100_128",
            "sample_rate": 44100,
            "lang": "en",
            "elevenlabs_ws": None,
            "elevenlabs_task": None,
            "cancel_flag": False
        }

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
            api_key = os.getenv("ELEVENLABS_API_KEY") or getattr(services.get("settings", None), "elevenlabs_api_key", None)
            if not api_key:
                await websocket.send_json({"type": "tts.error", "code": "NO_API_KEY", "message": "Missing ELEVENLABS_API_KEY"})
                return

            voice_id = session["voice_id"]
            model = session["model"]
            output_format = session["format"]

            # ElevenLabs realtime TTS WS endpoint (stream-input, voice_id in path)
            # Auth via Authorization: Bearer <API_KEY> in handshake headers
            url = f"wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input"

            try:
                # Use aiohttp to pass Authorization header during WS handshake
                aiohttp_session = ClientSession()
                # Keep reference to close later with the WS
                session["_aiohttp_session"] = aiohttp_session
                el_ws = await aiohttp_session.ws_connect(
                    url,
                    headers={"Authorization": f"Bearer {api_key}"},
                    autoclose=False,
                    autoping=True,
                    max_msg_size=2 * 1024 * 1024
                )
                session["elevenlabs_ws"] = el_ws
            except WSServerHandshakeError as e:
                # Surface HTTP status for diagnostics (401/403)
                await websocket.send_json({
                    "type": "tts.error",
                    "code": "CONNECT_FAILED",
                    "status": getattr(e, 'status', None),
                    "message": f"Handshake failed: {str(e)}"
                })
                return
            except Exception as e:
                await websocket.send_json({"type": "tts.error", "code": "CONNECT_FAILED", "message": str(e)})
                return

            async def pump_from_elevenlabs():
                try:
                    # For stream-input, after handshake with Authorization header,
                    # send a "start" message containing synthesis params and content.
                    start_payload = {
                        "type": "start",
                        "model_id": model,
                        "output_format": output_format,
                        "optimize_streaming_latency": 3,
                        "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}
                    }
                    if ssml:
                        start_payload["ssml"] = ssml
                    elif text:
                        start_payload["text"] = text
                    await el_ws.send_json(start_payload)

                    # Read frames from ElevenLabs (aiohttp WS API)
                    while True:
                        msg = await el_ws.receive()
                        if msg.type == WSMsgType.BINARY:
                            if websocket.client_state == WebSocketState.CONNECTED:
                                await websocket.send_bytes(msg.data)
                            else:
                                break
                        elif msg.type == WSMsgType.TEXT:
                            try:
                                data = json.loads(msg.data)
                            except Exception:
                                await websocket.send_json({"type": "tts.debug", "raw": str(msg.data)})
                                continue
                            event_type = data.get("type") or data.get("event") or ""
                            if "viseme" in event_type.lower() or "phoneme" in event_type.lower() or "timestamp" in data:
                                time_ms = int(float(data.get("offset", data.get("timestamp", 0))) * 1000) if isinstance(data.get("timestamp"), float) else data.get("time_ms", 0)
                                phoneme = data.get("phoneme") or data.get("viseme") or data.get("morph") or ""
                                weight = float(data.get("weight", 1.0))
                                morph = await morph_map(phoneme)
                                await websocket.send_json({"type": "tts.viseme","time_ms": time_ms,"morph": morph,"weight": weight})
                            elif data.get("isFinal") or data.get("final"):
                                await websocket.send_json({"type": "tts.end"})
                            else:
                                await websocket.send_json({"type": "tts.meta", "data": data})
                                # Diagnostics: explicit unauthorized
                                try:
                                    code = int(data.get("code", 0))
                                except Exception:
                                    code = 0
                                if code in (401, 403) or "unauthorized" in str(data).lower():
                                    await websocket.send_json({"type": "tts.error", "code": "UNAUTHORIZED", "message": "ElevenLabs authentication failed (401/403). Check ELEVENLABS_API_KEY and account access."})
                                    break
                        elif msg.type in (WSMsgType.CLOSE, WSMsgType.CLOSING, WSMsgType.CLOSED):
                            break
                        elif msg.type == WSMsgType.ERROR:
                            await websocket.send_json({"type": "tts.error", "code": "STREAM_ERROR", "message": str(el_ws.exception())})
                            break

                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_json({"type": "tts.error", "code": "STREAM_ERROR", "message": str(e)})
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

            while True:
                # Allow both text and binary? Control plane is JSON here.
                raw = await websocket.receive_text()
                msg = json.loads(raw)
                mtype = msg.get("type")

                if mtype == "tts.start":
                    session["voice_id"] = msg.get("voiceId", session["voice_id"])
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

                elif mtype in ("tts.text", "tts.ssml"):
                    text = msg.get("text") if mtype == "tts.text" else None
                    ssml = msg.get("ssml") if mtype == "tts.ssml" else None

                    # If another stream is active, close it first
                    await close_elevenlabs()
                    session["cancel_flag"] = False
                    await open_elevenlabs_stream(text=text, ssml=ssml)

                elif mtype == "tts.cancel":
                    session["cancel_flag"] = True
                    await close_elevenlabs()
                    await websocket.send_json({"type": "tts.canceled"})

                elif mtype == "tts.end":
                    await close_elevenlabs()
                    await websocket.send_json({"type": "tts.end"})
                    break

                else:
                    await websocket.send_json({"type": "tts.error", "code": "UNKNOWN_TYPE", "message": f"Unknown message type: {mtype}"})

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