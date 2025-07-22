"""
AURA Audio Processing Utilities

Audio processing functions and classes for real-time voice analysis
using librosa and soundfile for high-quality audio processing.
"""

import io
import numpy as np
import librosa
import soundfile as sf
from typing import Tuple, Optional, Dict, Any, List
from collections import deque
from datetime import datetime
import asyncio
from threading import Lock

from utils.logging import get_logger
from utils.exceptions import InvalidAudioFormatError, AudioProcessingException

logger = get_logger(__name__)


class AudioBuffer:
    """
    Thread-safe circular buffer for streaming audio data with real-time processing.
    
    Handles audio chunks with automatic sample rate conversion and format normalization.
    Optimized for low-latency real-time processing.
    """
    
    def __init__(self, 
                 sample_rate: int = 16000,
                 chunk_size: int = 1600,  # 100ms at 16kHz
                 max_buffer_seconds: float = 10.0):
        """
        Initialize audio buffer.
        
        Args:
            sample_rate: Target sample rate in Hz
            chunk_size: Size of each audio chunk in samples
            max_buffer_seconds: Maximum buffer duration in seconds
        """
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.max_buffer_size = int(sample_rate * max_buffer_seconds)
        
        # Circular buffer for audio samples
        self.buffer = deque(maxlen=self.max_buffer_size)
        self.lock = Lock()
        
        # Metadata tracking
        self.total_samples_added = 0
        self.chunks_processed = 0
        self.start_time = datetime.utcnow()
        
        logger.info(
            "Initialized AudioBuffer",
            extra={
                "sample_rate": sample_rate,
                "chunk_size": chunk_size,
                "max_buffer_seconds": max_buffer_seconds
            }
        )
    
    def add_chunk(self, audio_data: bytes, source_sample_rate: Optional[int] = None) -> bool:
        """
        Add audio chunk to buffer with automatic format conversion.
        
        Args:
            audio_data: Raw audio bytes
            source_sample_rate: Original sample rate (if known)
            
        Returns:
            bool: True if chunk added successfully
        """
        try:
            # Convert bytes to numpy array
            audio_array = self._bytes_to_array(audio_data, source_sample_rate)
            
            with self.lock:
                # Add samples to buffer
                for sample in audio_array:
                    self.buffer.append(sample)
                
                self.total_samples_added += len(audio_array)
                self.chunks_processed += 1
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to add audio chunk: {e}")
            return False
    
    def get_chunk(self, size: Optional[int] = None) -> Optional[np.ndarray]:
        """
        Get audio chunk from buffer.
        
        Args:
            size: Number of samples to retrieve (default: chunk_size)
            
        Returns:
            np.ndarray: Audio samples or None if insufficient data
        """
        if size is None:
            size = self.chunk_size
        
        with self.lock:
            if len(self.buffer) < size:
                return None
            
            # Extract samples
            chunk = np.array([self.buffer.popleft() for _ in range(size)])
            return chunk.astype(np.float32)
    
    def peek_chunk(self, size: Optional[int] = None) -> Optional[np.ndarray]:
        """
        Peek at audio chunk without removing from buffer.
        
        Args:
            size: Number of samples to peek at
            
        Returns:
            np.ndarray: Audio samples or None if insufficient data
        """
        if size is None:
            size = self.chunk_size
        
        with self.lock:
            if len(self.buffer) < size:
                return None
            
            # Peek at samples without removing
            chunk = np.array(list(self.buffer)[:size])
            return chunk.astype(np.float32)
    
    def available_samples(self) -> int:
        """Get number of available samples in buffer."""
        with self.lock:
            return len(self.buffer)
    
    def clear(self):
        """Clear the audio buffer."""
        with self.lock:
            self.buffer.clear()
    
    def _bytes_to_array(self, audio_data: bytes, source_sample_rate: Optional[int] = None) -> np.ndarray:
        """
        Convert audio bytes to numpy array with sample rate conversion.
        
        Args:
            audio_data: Raw audio bytes
            source_sample_rate: Original sample rate
            
        Returns:
            np.ndarray: Normalized audio samples
        """
        try:
            # Try to load as various formats
            audio_array = None
            original_sr = source_sample_rate
            
            # Try soundfile first (supports more formats)
            try:
                with io.BytesIO(audio_data) as audio_io:
                    audio_array, original_sr = sf.read(audio_io, dtype='float32')
            except Exception:
                # Fallback: assume raw PCM 16-bit
                audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
                original_sr = source_sample_rate or self.sample_rate
            
            # Convert to mono if stereo
            if len(audio_array.shape) > 1:
                audio_array = librosa.to_mono(audio_array.T)
            
            # Resample if necessary
            if original_sr != self.sample_rate:
                audio_array = librosa.resample(
                    audio_array, 
                    orig_sr=original_sr, 
                    target_sr=self.sample_rate
                )
            
            return audio_array
            
        except Exception as e:
            raise AudioProcessingException(f"Failed to convert audio data: {e}")


def analyze_voice_metrics(audio_array: np.ndarray, sample_rate: int = 16000) -> Dict[str, Any]:
    """
    Analyze voice metrics from audio array using librosa.
    
    Args:
        audio_array: Audio samples
        sample_rate: Sample rate in Hz
        
    Returns:
        Dict containing voice analysis metrics
    """
    try:
        if len(audio_array) == 0:
            return _empty_metrics()
        
        # Basic audio properties
        duration = len(audio_array) / sample_rate
        
        # RMS Energy (volume/loudness)
        rms_energy = librosa.feature.rms(y=audio_array)[0]
        avg_volume = float(np.mean(rms_energy))
        volume_std = float(np.std(rms_energy))
        
        # Spectral features
        spectral_centroids = librosa.feature.spectral_centroid(y=audio_array, sr=sample_rate)[0]
        avg_spectral_centroid = float(np.mean(spectral_centroids))
        
        # Pitch analysis
        pitches, magnitudes = librosa.piptrack(y=audio_array, sr=sample_rate)
        pitch_values = []
        for t in range(pitches.shape[1]):
            index = magnitudes[:, t].argmax()
            pitch = pitches[index, t]
            if pitch > 0:  # Valid pitch
                pitch_values.append(pitch)
        
        avg_pitch = float(np.mean(pitch_values)) if pitch_values else 0.0
        pitch_variance = float(np.var(pitch_values)) if pitch_values else 0.0
        
        # Tempo estimation (speaking rate)
        tempo, beats = librosa.beat.beat_track(y=audio_array, sr=sample_rate)
        
        # Zero crossing rate (indicator of voiced/unvoiced speech)
        zcr = librosa.feature.zero_crossing_rate(audio_array)[0]
        avg_zcr = float(np.mean(zcr))
        
        # Spectral rolloff (frequency content)
        rolloff = librosa.feature.spectral_rolloff(y=audio_array, sr=sample_rate)[0]
        avg_rolloff = float(np.mean(rolloff))
        
        # Voice activity detection (simple energy-based)
        voice_activity = _detect_voice_activity(audio_array, rms_energy)
        
        return {
            "duration": duration,
            "avg_volume": avg_volume,
            "volume_consistency": 1.0 - (volume_std / (avg_volume + 1e-6)),
            "avg_pitch": avg_pitch,
            "pitch_variance": pitch_variance,
            "spectral_centroid": avg_spectral_centroid,
            "tempo": float(tempo),
            "zero_crossing_rate": avg_zcr,
            "spectral_rolloff": avg_rolloff,
            "voice_activity_ratio": voice_activity["activity_ratio"],
            "speech_segments": voice_activity["segments"],
            "estimated_words": _estimate_word_count(duration, voice_activity["activity_ratio"]),
            "clarity_score": _calculate_clarity_score(avg_zcr, avg_spectral_centroid, avg_volume),
            "pace_wpm": _estimate_speaking_pace(duration, voice_activity["activity_ratio"])
        }
        
    except Exception as e:
        logger.error(f"Voice analysis failed: {e}")
        return _empty_metrics()


def _detect_voice_activity(audio_array: np.ndarray, rms_energy: np.ndarray, 
                          threshold_factor: float = 0.1) -> Dict[str, Any]:
    """
    Simple voice activity detection based on energy thresholding.
    
    Args:
        audio_array: Audio samples
        rms_energy: RMS energy values
        threshold_factor: Threshold as factor of mean energy
        
    Returns:
        Dict with voice activity information
    """
    # Calculate dynamic threshold
    mean_energy = np.mean(rms_energy)
    threshold = mean_energy * threshold_factor
    
    # Find voice segments
    voice_frames = rms_energy > threshold
    activity_ratio = np.sum(voice_frames) / len(voice_frames)
    
    # Find continuous segments
    segments = []
    in_segment = False
    start_frame = 0
    
    for i, is_voice in enumerate(voice_frames):
        if is_voice and not in_segment:
            start_frame = i
            in_segment = True
        elif not is_voice and in_segment:
            segments.append((start_frame, i))
            in_segment = False
    
    if in_segment:  # Close last segment
        segments.append((start_frame, len(voice_frames)))
    
    return {
        "activity_ratio": float(activity_ratio),
        "segments": segments,
        "total_segments": len(segments)
    }


def _calculate_clarity_score(zcr: float, spectral_centroid: float, volume: float) -> float:
    """
    Calculate speech clarity score based on acoustic features.
    
    Args:
        zcr: Zero crossing rate
        spectral_centroid: Average spectral centroid
        volume: Average volume
        
    Returns:
        Clarity score between 0 and 1
    """
    # Normalize features (rough estimates for typical speech)
    zcr_norm = min(zcr / 0.1, 1.0)  # Typical ZCR for speech
    centroid_norm = min(spectral_centroid / 2000.0, 1.0)  # Typical centroid
    volume_norm = min(volume / 0.1, 1.0)  # Reasonable volume level
    
    # Weighted combination (higher spectral centroid and moderate ZCR = clearer)
    clarity = (0.4 * centroid_norm + 0.3 * (1.0 - zcr_norm) + 0.3 * volume_norm)
    return float(np.clip(clarity, 0.0, 1.0))


def _estimate_speaking_pace(duration: float, voice_activity_ratio: float) -> float:
    """
    Estimate speaking pace in words per minute.
    
    Args:
        duration: Audio duration in seconds
        voice_activity_ratio: Ratio of time spent speaking
        
    Returns:
        Estimated words per minute
    """
    if duration <= 0 or voice_activity_ratio <= 0:
        return 0.0
    
    # Rough estimate: average speaker says ~2.5 words per second during active speech
    words_per_second = 2.5
    active_duration = duration * voice_activity_ratio
    estimated_words = active_duration * words_per_second
    
    # Convert to words per minute
    wpm = (estimated_words / duration) * 60
    return float(wpm)


def _estimate_word_count(duration: float, voice_activity_ratio: float) -> int:
    """
    Estimate number of words spoken.
    
    Args:
        duration: Audio duration in seconds
        voice_activity_ratio: Ratio of time spent speaking
        
    Returns:
        Estimated word count
    """
    if duration <= 0 or voice_activity_ratio <= 0:
        return 0
    
    active_duration = duration * voice_activity_ratio
    estimated_words = active_duration * 2.5  # ~2.5 words per second
    return int(estimated_words)


def _empty_metrics() -> Dict[str, Any]:
    """Return empty metrics dict for error cases."""
    return {
        "duration": 0.0,
        "avg_volume": 0.0,
        "volume_consistency": 0.0,
        "avg_pitch": 0.0,
        "pitch_variance": 0.0,
        "spectral_centroid": 0.0,
        "tempo": 0.0,
        "zero_crossing_rate": 0.0,
        "spectral_rolloff": 0.0,
        "voice_activity_ratio": 0.0,
        "speech_segments": [],
        "estimated_words": 0,
        "clarity_score": 0.0,
        "pace_wpm": 0.0
    }


def convert_audio_format(audio_data: bytes, 
                        target_format: str = "wav",
                        target_sample_rate: int = 16000) -> bytes:
    """
    Convert audio data to target format and sample rate.
    
    Args:
        audio_data: Input audio bytes
        target_format: Target audio format
        target_sample_rate: Target sample rate
        
    Returns:
        Converted audio bytes
    """
    try:
        # Load audio
        with io.BytesIO(audio_data) as input_io:
            audio_array, original_sr = sf.read(input_io, dtype='float32')
        
        # Convert to mono if stereo
        if len(audio_array.shape) > 1:
            audio_array = librosa.to_mono(audio_array.T)
        
        # Resample if necessary
        if original_sr != target_sample_rate:
            audio_array = librosa.resample(
                audio_array, 
                orig_sr=original_sr, 
                target_sr=target_sample_rate
            )
        
        # Convert to target format
        output_io = io.BytesIO()
        sf.write(output_io, audio_array, target_sample_rate, format=target_format.upper())
        return output_io.getvalue()
        
    except Exception as e:
        raise AudioProcessingException(f"Audio format conversion failed: {e}")


async def process_audio_stream_async(audio_buffer: AudioBuffer, 
                                   callback_func,
                                   chunk_duration: float = 0.1) -> None:
    """
    Process audio stream asynchronously with callback for each chunk.
    
    Args:
        audio_buffer: AudioBuffer instance
        callback_func: Async function to call with each processed chunk
        chunk_duration: Duration of each processing chunk in seconds
    """
    chunk_size = int(audio_buffer.sample_rate * chunk_duration)
    
    while True:
        try:
            # Get chunk from buffer
            chunk = audio_buffer.get_chunk(chunk_size)
            if chunk is None:
                await asyncio.sleep(0.01)  # Wait for more data
                continue
            
            # Analyze chunk
            metrics = analyze_voice_metrics(chunk, audio_buffer.sample_rate)
            
            # Call callback with results
            await callback_func(chunk, metrics)
            
        except Exception as e:
            logger.error(f"Stream processing error: {e}")
            await asyncio.sleep(0.1) 