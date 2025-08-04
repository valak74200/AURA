"""
ElevenLabs Voice/TTS Service

Implements IVoiceService: synthesize(text) - returns audio and viseme timeline
using ElevenLabs API. Defaults come from app.config Settings.
"""

from __future__ import annotations

import base64
import json
from typing import Any, Dict, Optional, List

import httpx

from app.config import get_settings
from utils.logging import get_logger
from services.service_interfaces import IVoiceService

logger = get_logger(__name__)


class ElevenLabsVoiceService(IVoiceService):
    """
    ElevenLabs TTS implementation.
    Uses text-to-speech with phoneme/viseme marks, building a simple viseme timeline.
    """

    def __init__(self, settings=None):
        self.settings = settings or get_settings()
        self.api_key = self.settings.elevenlabs_api_key
        self.default_voice = self.settings.elevenlabs_default_voice_id
        self.model = self.settings.elevenlabs_model
        self.sample_rate = int(self.settings.elevenlabs_sample_rate)

        if not self.api_key:
            raise RuntimeError("ELEVENLABS_API_KEY is missing in configuration")

        # Base endpoints (v1 REST)
        self.base_url = "https://api.elevenlabs.io/v1"
        # Text-to-speech endpoint requires voice_id path parameter
        self.tts_endpoint_tpl = self.base_url + "/text-to-speech/{voice_id}"

    async def initialize(self):
        # No persistent connections required; httpx created per request
        logger.info("ElevenLabsVoiceService initialized")

    async def cleanup(self):
        # Nothing to cleanup explicitly
        pass

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        model: Optional[str] = None,
        sample_rate: Optional[int] = None,
        lang: Optional[str] = None,
        output_format: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Synthesize speech and return:
          {
            "audio_base64": str,
            "sample_rate": int,
            "visemes": [{ "time_ms": int, "morph": str, "weight": float }, ...],
            "text": str,
            "voice_id": str,
            "model": str
          }
        """
        v_id = voice_id or self.default_voice
        mdl = model or self.model
        sr = int(sample_rate or self.sample_rate)

        # ElevenLabs supports multiple output formats; we will request PCM or mp3.
        # For lipsync, we also need timing marks. ElevenLabs provides "phoneme" and "word" timings
        # via "pronunciation_dictionary_locators"/"alignment" in their responses for certain endpoints.
        # In the REST API, we can request "enable_ssml": False and "apply_text_normalization": True.
        # Some timing/marks features are available in "experimental" or streaming APIs.
        #
        # For this MVP, we will:
        #  - Request MP3 audio for broad compatibility (frontend can decode easily).
        #  - Use "pronunciation" + "timing" hints if available from response "alignment" endpoint
        #    by making a follow-up request to /v1/text-to-speech/{voice_id}/stream/with-timestamps (if enabled).
        #  - If not available, fallback to naive timing estimation (uniform distribution over duration).
        #
        # Note: REST timing marks availability can vary; we implement a best-effort approach.

        # Build request to generate audio
        url = self.tts_endpoint_tpl.format(voice_id=v_id)
 
        # See ElevenLabs API reference for accepted body fields
        # Determine output_format from explicit param first, else by sample rate
        resolved_format = output_format or ("mp3_44100_128" if sr == 44100 else "mp3_22050_128")

        payload: Dict[str, Any] = {
            "text": text,
            "model_id": mdl,
            "voice_settings": {
                # Defaults; these can be made configurable later
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            },
            "output_format": resolved_format,
        }

        headers = {
            "Accept": "application/json",
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }

        audio_base64: Optional[str] = None
        visemes: List[Dict[str, Any]] = []

        async with httpx.AsyncClient(timeout=60.0) as client:
            # Request audio bytes
            try:
                # Using non-stream endpoint for simplicity; returns audio bytes directly when Accept is audio
                # However ElevenLabs requires "Accept: audio/mpeg" to return raw audio bytes.
                # We'll switch Accept header for the audio call:
                audio_headers = headers.copy()
                audio_headers["Accept"] = "audio/mpeg"

                audio_resp = await client.post(url, headers=audio_headers, content=json.dumps(payload))
                audio_resp.raise_for_status()
                audio_bytes = audio_resp.content
                audio_base64 = base64.b64encode(audio_bytes).decode("ascii")
            except httpx.HTTPStatusError as e:
                logger.error(f"ElevenLabs TTS failed (status): {e.response.status_code} {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"ElevenLabs TTS request failed: {e}")
                raise

            # Attempt to get timestamps/marks if available via a secondary endpoint
            # ElevenLabs has a streaming endpoint with "with-timestamps" that can return JSON lines with timing.
            # For REST-only MVP, we will approximate visemes with a simple heuristic since official REST timing
            # data may not be directly available without streaming:
            #   - Estimate duration from chars at ~14 chars per 100 ms (very rough) and distribute phoneme buckets.
            # This is a placeholder until the WS streaming with real timing is added.
            try:
                estimated_duration_ms = self._estimate_duration_ms(text)
                visemes = self._approximate_visemes_from_text(text, estimated_duration_ms)
            except Exception as e:
                logger.warning(f"Failed to compute viseme approximation: {e}")
                visemes = []

        return {
            "audio_base64": audio_base64,
            "sample_rate": sr,
            "visemes": visemes,
            "text": text,
            "voice_id": v_id,
            "model": mdl,
        }

    def _estimate_duration_ms(self, text: str) -> int:
        # Very rough heuristic: average 12 chars ~ 100ms (600 chars ~ 5s)
        # clamp between 500ms and 30s
        n = max(1, len(text))
        est = int((n / 12.0) * 100.0)
        return max(500, min(est, 30000))

    def _approximate_visemes_from_text(self, text: str, duration_ms: int) -> List[Dict[str, Any]]:
        # Map rough vowel groups to mouth shapes; distribute evenly through duration
        morph_map = [
            ("AA", set("aàâäáãå")),
            ("IY", set("iîïí")),
            ("UW", set("ouúûù")),
            ("EH", set("eéèêë")),
            ("OH", set("oôöóõ")),
            ("S", set("sçz")),
            ("F", set("fv")),
            ("TH", set("td")),
            ("L", set("l")),
            ("R", set("r")),
            ("M", set("bmp")),
        ]
        # Choose checkpoints equal to number of words capped
        words = [w for w in text.split() if w]
        count = max(4, min(24, len(words) or 8))
        step = duration_ms // count if count else duration_ms

        visemes: List[Dict[str, Any]] = []
        t = 0
        for i in range(count):
            sample_char = words[i % len(words)][0] if words else "a"
            morph = "AA"
            for name, charset in morph_map:
                if sample_char.lower() in charset:
                    morph = name
                    break
            weight = 0.6 if morph in ("AA", "IY", "UW", "OH", "EH") else 0.45
            visemes.append({"time_ms": t, "morph": morph, "weight": round(weight, 2)})
            t += step
        # Ensure last point lands at end
        if visemes:
            visemes[-1]["time_ms"] = duration_ms
        return visemes