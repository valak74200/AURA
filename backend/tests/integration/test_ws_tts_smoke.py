import asyncio
import json
import os
import base64
import pytest

import websockets

BACKEND_WS_URL = os.environ.get("AURA_WS_URL", "ws://127.0.0.1:8000/ws/tts")


@pytest.mark.asyncio
async def test_ws_tts_smoke_start_text_end_event_loop():
    """
    Smoke test for /ws/tts endpoint:
      - Connect and receive tts.ready
      - Send tts.start and expect tts.start ack
      - Send tts.text and expect at least one of: binary audio frame OR viseme/meta
      - Receive server heartbeat ping and finally send tts.end to close
    Skip automatically if ELEVENLABS_API_KEY is not provided (external dependency).
    """
    if not (os.getenv("ELEVENLABS_API_KEY") or os.getenv("ELEVENLABS_API_KEY".lower())):
        pytest.skip("ELEVENLABS_API_KEY not set; skipping external WS TTS smoke test")

    # Collect some signals
    got_ready = False
    got_start_ack = False
    got_audio_or_viseme = False
    got_ping = False

    async with websockets.connect(BACKEND_WS_URL, max_size=4 * 1024 * 1024) as ws:
        # Expect initial control messages; server may send tts.meta before tts.ready
        deadline = asyncio.get_event_loop().time() + 10
        while asyncio.get_event_loop().time() < deadline and not got_ready:
            msg = await asyncio.wait_for(ws.recv(), timeout=2)
            if isinstance(msg, (bytes, bytearray)):
                pytest.fail("Expected JSON control message but received binary before ready")
            data = json.loads(msg)
            t = data.get("type")
            if t == "tts.ready":
                got_ready = True
            elif t in ("tts.meta", "ping"):
                # acceptable pre-ready meta/heartbeat
                continue
            elif t in ("tts.error", "error"):
                pytest.fail(f"Server returned error before ready: {data}")
            else:
                # Ignore unknown control frames pre-ready
                continue
        assert got_ready, "Did not receive initial tts.ready within 10s"

        # Send start with defaults
        await ws.send(json.dumps({
            "type": "tts.start",
            "voiceId": "Rachel",
            "model": "eleven_multilingual_v2",
            "format": "mp3_44100_128",
            "sampleRate": 44100,
            "lang": "en"
        }))

        # Wait for ack
        ack_deadline = asyncio.get_event_loop().time() + 15
        while asyncio.get_event_loop().time() < ack_deadline:
            incoming = await asyncio.wait_for(ws.recv(), timeout=3)
            if isinstance(incoming, (bytes, bytearray)):
                # Could be audio already (some servers ack then audio quickly)
                got_audio_or_viseme = True
                break
            payload = json.loads(incoming)
            t = payload.get("type")
            if t == "tts.start":
                got_start_ack = True
                break
            elif t == "ping":
                got_ping = True
            elif t == "tts.meta":
                # Accept meta during startup
                continue
            elif t in ("tts.error", "error"):
                pytest.fail(f"Server returned error on start: {payload}")
        assert got_start_ack or got_audio_or_viseme, "Did not receive tts.start ack or early audio"

        # Send a short text to synthesize
        await ws.send(json.dumps({
            "type": "tts.text",
            "text": "Hello, this is a quick latency test of the ElevenLabs TTS streaming through AURA."
        }))

        # Read a few frames/messages to validate at least one audio or viseme/meta arrives
        deadline = asyncio.get_event_loop().time() + 25
        while asyncio.get_event_loop().time() < deadline and not got_audio_or_viseme:
            try:
                incoming = await asyncio.wait_for(ws.recv(), timeout=5)
            except asyncio.TimeoutError:
                continue

            if isinstance(incoming, (bytes, bytearray)):
                # Got binary audio
                assert len(incoming) > 0
                got_audio_or_viseme = True
                continue

            payload = json.loads(incoming)
            t = payload.get("type")
            if t == "tts.viseme":
                # Validate minimal structure
                assert "time_ms" in payload
                assert "morph" in payload
                got_audio_or_viseme = True
            elif t == "ping":
                got_ping = True
            elif t == "tts.meta":
                # Accept as signal of activity
                got_audio_or_viseme = True
            elif t in ("tts.error", "error"):
                pytest.fail(f"Server returned error during streaming: {payload}")

        # End the session
        await ws.send(json.dumps({"type": "tts.end"}))

        # We may or may not get a tts.end echo; don't enforce
        # Drain a bit to capture a final ping or end
        for _ in range(3):
            try:
                incoming = await asyncio.wait_for(ws.recv(), timeout=2)
                if not isinstance(incoming, (bytes, bytearray)):
                    payload = json.loads(incoming)
                    if payload.get("type") == "ping":
                        got_ping = True
            except asyncio.TimeoutError:
                break

    # Assertions
    assert got_ready, "Did not receive initial tts.ready"
    assert got_start_ack, "Did not receive tts.start ack"
    assert got_audio_or_viseme, "Did not receive audio or viseme/meta messages"
    # Heartbeat is every 20s; the test may complete before that. Don't make it hard-fail.
    # Still, we record it for visibility.