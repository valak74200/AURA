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
import struct
import wave

# Import fallback libraries
try:
    from pydub import AudioSegment
    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False

try:
    from scipy.io import wavfile
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

from utils.logging import get_logger
from utils.exceptions import InvalidAudioFormatError, AudioProcessingException
from models.session import SupportedLanguage
from utils.language_config import get_audio_config, AudioAnalysisConfig
from utils.json_encoder import serialize_response_data

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
            
            return bool(True)
            
        except Exception as e:
            logger.error(f"Failed to add audio chunk: {e}")
            return bool(False)
    
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
        Convert audio bytes to numpy array with sample rate conversion using fallback methods.
        
        Args:
            audio_data: Raw audio bytes
            source_sample_rate: Original sample rate (if known)
            
        Returns:
            np.ndarray: Normalized audio samples
        """
        try:
            # Use the new fallback loading function
            audio_array, detected_sr = load_audio_with_fallbacks(audio_data, self.sample_rate)
            return audio_array
            
        except Exception as e:
            raise AudioProcessingException(f"Failed to convert audio data: {e}")


def load_audio_with_fallbacks(audio_data: bytes, target_sample_rate: int = 16000) -> Tuple[np.ndarray, int]:
    """
    Load audio data using multiple fallback methods.
    
    Args:
        audio_data: Raw audio bytes
        target_sample_rate: Desired sample rate
        
    Returns:
        Tuple of (audio_array, sample_rate)
    """
    errors = []
    
    # Method 1: Try soundfile first (best quality, most formats)
    try:
        with io.BytesIO(audio_data) as audio_io:
            audio_array, original_sr = sf.read(audio_io, dtype='float32')
            
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
            
        logger.info(f"Successfully loaded audio using soundfile: {len(audio_array)} samples at {target_sample_rate}Hz")
        return audio_array, target_sample_rate
        
    except Exception as e:
        errors.append(f"soundfile: {e}")
        logger.debug(f"soundfile failed: {e}")
    
    # Method 2: Try pydub if available
    if PYDUB_AVAILABLE:
        try:
            # Try to load with pydub
            audio_segment = AudioSegment.from_file(io.BytesIO(audio_data))
            
            # Convert to mono and target sample rate
            audio_segment = audio_segment.set_channels(1).set_frame_rate(target_sample_rate)
            
            # Convert to numpy array
            audio_array = np.array(audio_segment.get_array_of_samples(), dtype=np.float32)
            audio_array = audio_array / 32768.0  # Normalize from int16 to float32
            
            logger.info(f"Successfully loaded audio using pydub: {len(audio_array)} samples at {target_sample_rate}Hz")
            return audio_array, target_sample_rate
            
        except Exception as e:
            errors.append(f"pydub: {e}")
            logger.debug(f"pydub failed: {e}")
    
    # Method 3: Try scipy wavfile if available
    if SCIPY_AVAILABLE:
        try:
            sample_rate, audio_array = wavfile.read(io.BytesIO(audio_data))
            
            # Convert to float32
            if audio_array.dtype == np.int16:
                audio_array = audio_array.astype(np.float32) / 32768.0
            elif audio_array.dtype == np.int32:
                audio_array = audio_array.astype(np.float32) / 2147483648.0
            else:
                audio_array = audio_array.astype(np.float32)
            
            # Convert to mono if stereo
            if len(audio_array.shape) > 1:
                audio_array = librosa.to_mono(audio_array.T)
            
            # Resample if necessary
            if sample_rate != target_sample_rate:
                audio_array = librosa.resample(
                    audio_array, 
                    orig_sr=sample_rate, 
                    target_sr=target_sample_rate
                )
            
            logger.info(f"Successfully loaded audio using scipy: {len(audio_array)} samples at {target_sample_rate}Hz")
            return audio_array, target_sample_rate
            
        except Exception as e:
            errors.append(f"scipy: {e}")
            logger.debug(f"scipy failed: {e}")
    
    # Method 4: Try standard wave library
    try:
        with wave.open(io.BytesIO(audio_data), 'rb') as wav_file:
            sample_rate = wav_file.getframerate()
            n_channels = wav_file.getnchannels()
            sample_width = wav_file.getsampbits()
            n_frames = wav_file.getnframes()
            
            # Read raw frames
            frames = wav_file.readframes(n_frames)
            
            # Convert based on sample width
            if sample_width == 1:
                audio_array = np.frombuffer(frames, dtype=np.uint8).astype(np.float32) / 128.0 - 1.0
            elif sample_width == 2:
                audio_array = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
            elif sample_width == 3:
                # 24-bit handling
                audio_bytes = np.frombuffer(frames, dtype=np.uint8)
                audio_array = np.zeros(len(audio_bytes) // 3, dtype=np.float32)
                for i in range(len(audio_array)):
                    sample = int.from_bytes(audio_bytes[i*3:(i+1)*3], byteorder='little', signed=True)
                    audio_array[i] = sample / 8388608.0
            elif sample_width == 4:
                audio_array = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / 2147483648.0
            else:
                raise ValueError(f"Unsupported sample width: {sample_width}")
            
            # Handle multichannel
            if n_channels > 1:
                audio_array = audio_array.reshape(-1, n_channels)
                audio_array = librosa.to_mono(audio_array.T)
            
            # Resample if necessary
            if sample_rate != target_sample_rate:
                audio_array = librosa.resample(
                    audio_array, 
                    orig_sr=sample_rate, 
                    target_sr=target_sample_rate
                )
            
            logger.info(f"Successfully loaded audio using wave library: {len(audio_array)} samples at {target_sample_rate}Hz")
            return audio_array, target_sample_rate
            
    except Exception as e:
        errors.append(f"wave: {e}")
        logger.debug(f"wave library failed: {e}")
    
    # Method 5: Try raw PCM data as last resort
    try:
        # Assume 16-bit PCM, mono, target sample rate
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        
        if len(audio_array) > 0:
            logger.warning(f"Loaded as raw PCM data: {len(audio_array)} samples (assumed {target_sample_rate}Hz)")
            return audio_array, target_sample_rate
            
    except Exception as e:
        errors.append(f"raw_pcm: {e}")
        logger.debug(f"raw PCM failed: {e}")
    
    # All methods failed
    error_summary = "; ".join(errors)
    raise AudioProcessingException(f"All audio loading methods failed. Errors: {error_summary}")


def detect_audio_format(audio_data: bytes) -> str:
    """
    Detect audio format from raw bytes.
    
    Args:
        audio_data: Raw audio bytes
        
    Returns:
        Detected format string or 'unknown'
    """
    if len(audio_data) < 12:
        return 'unknown'
    
    # Check for common audio format signatures
    header = audio_data[:12]
    
    # WAV format
    if header[:4] == b'RIFF' and header[8:12] == b'WAVE':
        return 'wav'
    
    # MP3 format
    if header[:3] == b'ID3' or header[:2] == b'\xff\xfb':
        return 'mp3'
    
    # FLAC format
    if header[:4] == b'fLaC':
        return 'flac'
    
    # OGG format
    if header[:4] == b'OggS':
        return 'ogg'
    
    # M4A/AAC format
    if b'ftyp' in header[:12]:
        return 'm4a'
    
    # AU format
    if header[:4] == b'.snd':
        return 'au'
    
    # AIFF format
    if header[:4] == b'FORM' and header[8:12] == b'AIFF':
        return 'aiff'
    
    return 'unknown'


def validate_audio_data(audio_data: bytes, max_size: int = 10485760) -> Dict[str, Any]:
    """
    Validate audio data and return information.
    
    Args:
        audio_data: Raw audio bytes
        max_size: Maximum allowed file size
        
    Returns:
        Dict with validation results
    """
    validation_result = {
        "valid": bool(False),
        "size_bytes": len(audio_data),
        "format": "unknown",
        "error": None,
        "warnings": []
    }
    
    # Check size
    if len(audio_data) == 0:
        validation_result["error"] = "Audio data is empty"
        return validation_result
    
    if len(audio_data) > max_size:
        validation_result["error"] = f"Audio data too large: {len(audio_data)} bytes (max: {max_size})"
        return validation_result
    
    # Detect format
    detected_format = detect_audio_format(audio_data)
    validation_result["format"] = detected_format
    
    if detected_format == 'unknown':
        validation_result["warnings"].append("Could not detect audio format - will attempt raw processing")
    
    # Try to load the audio to verify it's valid
    try:
        audio_array, sample_rate = load_audio_with_fallbacks(audio_data)
        validation_result["valid"] = bool(True)
        validation_result["duration_seconds"] = len(audio_array) / sample_rate
        validation_result["samples"] = len(audio_array)
        validation_result["sample_rate"] = sample_rate
        
        # Quality checks
        if np.max(np.abs(audio_array)) < 0.001:
            validation_result["warnings"].append("Audio appears to be very quiet or silent")
        
        if len(audio_array) < sample_rate * 0.1:  # Less than 100ms
            validation_result["warnings"].append("Audio is very short (less than 100ms)")
            
    except Exception as e:
        validation_result["error"] = f"Audio validation failed: {e}"
    
    # Ensure all boolean values are properly serializable
    return serialize_response_data(validation_result)


def analyze_voice_metrics(
    audio_array: np.ndarray, 
    sample_rate: int = 16000,
    language: SupportedLanguage = SupportedLanguage.FRENCH
) -> Dict[str, Any]:
    """
    Analyze voice metrics from audio array using librosa with language-specific adaptation.
    
    Args:
        audio_array: Audio samples
        sample_rate: Sample rate in Hz
        language: Target language for cultural adaptation
        
    Returns:
        Dict containing voice analysis metrics adapted to language expectations
    """
    try:
        if len(audio_array) == 0:
            return _empty_metrics()
        
        # Get language-specific configuration
        lang_config = get_audio_config(language)
        
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
        
        # Language-specific analysis
        pace_analysis = _analyze_pace_for_language(duration, voice_activity["activity_ratio"], lang_config)
        volume_analysis = _analyze_volume_for_language(avg_volume, volume_std, lang_config)
        pitch_analysis = _analyze_pitch_for_language(pitch_values, lang_config)
        clarity_analysis = _analyze_clarity_for_language(avg_zcr, avg_spectral_centroid, avg_volume, lang_config)
        
        metrics = {
            "duration": duration,
            "language": language.value,
            
            # Basic metrics
            "avg_volume": avg_volume,
            "volume_consistency": volume_analysis["consistency_score"],
            "avg_pitch": avg_pitch,
            "pitch_variance": pitch_variance,
            "spectral_centroid": avg_spectral_centroid,
            "tempo": float(tempo),
            "zero_crossing_rate": avg_zcr,
            "spectral_rolloff": avg_rolloff,
            "voice_activity_ratio": voice_activity["activity_ratio"],
            "speech_segments": voice_activity["segments"],
            
            # Language-adapted analysis
            "pace_analysis": pace_analysis,
            "volume_analysis": volume_analysis,
            "pitch_analysis": pitch_analysis,
            "clarity_analysis": clarity_analysis,
            
            # Derived metrics
            "estimated_words": _estimate_word_count(duration, voice_activity["activity_ratio"]),
            "clarity_score": clarity_analysis["overall_score"],
            "pace_wpm": pace_analysis["words_per_minute"],
            "language_specific_score": _calculate_language_score(pace_analysis, volume_analysis, pitch_analysis, clarity_analysis)
        }
        
        # Ensure all boolean values are properly serializable
        return serialize_response_data(metrics)
        
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


# ===== LANGUAGE-SPECIFIC ANALYSIS FUNCTIONS =====

def _analyze_pace_for_language(duration: float, voice_activity_ratio: float, config: AudioAnalysisConfig) -> Dict[str, Any]:
    """Analyze speaking pace with language-specific expectations."""
    if duration <= 0 or voice_activity_ratio <= 0:
        return {
            "words_per_minute": 0.0,
            "pace_score": 0.0,
            "pace_feedback": "Insufficient audio for pace analysis",
            "is_optimal": bool(False),
            "deviation_from_optimal": 0.0
        }
    
    # Calculate actual pace
    active_duration = duration * voice_activity_ratio
    # Language-specific words per second during active speech
    words_per_second = (config.natural_pace_min + config.natural_pace_max) / 2 / 60 * 60  # Convert to words/sec
    estimated_words = active_duration * words_per_second
    wpm = (estimated_words / duration) * 60
    
    # Evaluate against language expectations
    optimal_wpm = config.optimal_pace * 60  # Convert syllables/sec to approximate WPM
    min_wpm = config.natural_pace_min * 60
    max_wpm = config.natural_pace_max * 60
    
    # Calculate pace score (1.0 = optimal)
    if min_wpm <= wpm <= max_wpm:
        # Within natural range
        deviation = abs(wpm - optimal_wpm) / optimal_wpm
        pace_score = max(0.7, 1.0 - deviation)
        is_optimal = bool(deviation < 0.1)
    else:
        # Outside natural range
        if wpm < min_wpm:
            pace_score = max(0.2, wpm / min_wpm)
        else:  # wpm > max_wpm
            pace_score = max(0.2, max_wpm / wpm)
        is_optimal = bool(False)
    
    # Generate feedback
    if wpm < min_wpm * 0.8:
        feedback = "too_slow"
    elif wpm > max_wpm * 1.2:
        feedback = "too_fast"
    elif is_optimal:
        feedback = "optimal"
    else:
        feedback = "acceptable"
    
    return {
        "words_per_minute": float(wpm),
        "pace_score": float(pace_score),
        "pace_feedback": feedback,
        "is_optimal": is_optimal,
        "deviation_from_optimal": float(abs(wpm - optimal_wpm) / optimal_wpm),
        "language_expectations": {
            "min_wpm": float(min_wpm),
            "max_wpm": float(max_wpm),
            "optimal_wpm": float(optimal_wpm)
        }
    }


def _analyze_volume_for_language(avg_volume: float, volume_std: float, config: AudioAnalysisConfig) -> Dict[str, Any]:
    """Analyze volume characteristics with language-specific expectations."""
    
    # Calculate consistency score based on language expectations
    consistency_ratio = 1.0 - (volume_std / (avg_volume + 1e-6))
    consistency_score = max(0.0, min(1.0, consistency_ratio))
    
    # Language-specific volume evaluation
    is_consistent = bool(consistency_score >= config.volume_consistency_threshold)
    
    # Volume level assessment (relative to typical speech)
    volume_level = "appropriate"
    if avg_volume < 0.01:
        volume_level = "too_low"
        volume_score = 0.3
    elif avg_volume > 0.2:
        volume_level = "too_high" 
        volume_score = 0.7
    else:
        volume_score = 0.9
    
    # Dynamic range evaluation
    dynamic_range = volume_std / (avg_volume + 1e-6)
    dynamic_range_score = 1.0 - abs(dynamic_range - config.dynamic_range_optimal) / config.dynamic_range_optimal
    dynamic_range_score = max(0.0, min(1.0, dynamic_range_score))
    
    # Overall score
    overall_score = (volume_score * 0.4 + consistency_score * 0.4 + dynamic_range_score * 0.2)
    
    return {
        "consistency_score": float(consistency_score),
        "volume_level": volume_level,
        "volume_score": float(volume_score),
        "is_consistent": is_consistent,
        "dynamic_range_score": float(dynamic_range_score),
        "overall_score": float(overall_score),
        "language_expectations": {
            "consistency_threshold": config.volume_consistency_threshold,
            "optimal_dynamic_range": config.dynamic_range_optimal
        }
    }


def _analyze_pitch_for_language(pitch_values: List[float], config: AudioAnalysisConfig) -> Dict[str, Any]:
    """Analyze pitch patterns with language-specific expectations."""
    if not pitch_values:
        return {
            "variation_score": 0.0,
            "monotone_warning": bool(True),
            "pitch_range": 0.0,
            "intonation_pattern": "insufficient_data",
            "overall_score": 0.0
        }
    
    pitch_array = np.array(pitch_values)
    pitch_mean = np.mean(pitch_array)
    pitch_std = np.std(pitch_array)
    pitch_range = np.max(pitch_array) - np.min(pitch_array)
    
    # Calculate pitch variation relative to language expectations
    variation_ratio = pitch_std / (pitch_mean + 1e-6)
    variation_score = min(1.0, variation_ratio / config.pitch_variance_expected)
    
    # Monotone detection
    is_monotone = bool(variation_ratio < config.monotone_threshold)
    monotone_warning = is_monotone
    
    # Intonation pattern analysis
    if variation_ratio < config.monotone_threshold:
        intonation_pattern = "monotone"
        pattern_score = 0.3
    elif variation_ratio < config.pitch_variance_expected * 0.7:
        intonation_pattern = "limited_variation"
        pattern_score = 0.6
    elif variation_ratio <= config.pitch_variance_expected * 1.3:
        intonation_pattern = "good_variation"
        pattern_score = 0.9
    else:
        intonation_pattern = "excessive_variation"
        pattern_score = 0.7
    
    # Overall pitch score
    overall_score = (variation_score * 0.6 + pattern_score * 0.4)
    overall_score = max(0.0, min(1.0, overall_score))
    
    return {
        "variation_score": float(variation_score),
        "monotone_warning": monotone_warning,
        "pitch_range": float(pitch_range),
        "intonation_pattern": intonation_pattern,
        "overall_score": float(overall_score),
        "language_expectations": {
            "expected_variance": config.pitch_variance_expected,
            "monotone_threshold": config.monotone_threshold
        }
    }


def _analyze_clarity_for_language(zcr: float, spectral_centroid: float, volume: float, config: AudioAnalysisConfig) -> Dict[str, Any]:
    """Analyze speech clarity with language-specific weights."""
    
    # Normalize features
    zcr_norm = min(zcr / 0.1, 1.0)
    centroid_norm = min(spectral_centroid / 2000.0, 1.0)
    volume_norm = min(volume / 0.1, 1.0)
    
    # Language-specific weighted combination
    clarity_score = (
        config.clarity_weight * centroid_norm + 
        (0.5 - config.clarity_weight/2) * (1.0 - zcr_norm) + 
        (0.5 - config.clarity_weight/2) * volume_norm
    )
    clarity_score = max(0.0, min(1.0, clarity_score))
    
    # Clarity assessment
    if clarity_score >= 0.8:
        clarity_level = "excellent"
    elif clarity_score >= 0.6:
        clarity_level = "good"
    elif clarity_score >= 0.4:
        clarity_level = "acceptable"
    else:
        clarity_level = "needs_improvement"
    
    return {
        "overall_score": float(clarity_score),
        "clarity_level": clarity_level,
        "spectral_clarity": float(centroid_norm),
        "articulation_score": float(1.0 - zcr_norm),
        "volume_support": float(volume_norm),
        "language_expectations": {
            "clarity_weight": config.clarity_weight,
            "accent_tolerance": config.accent_tolerance
        }
    }


def _calculate_language_score(pace_analysis: Dict, volume_analysis: Dict, pitch_analysis: Dict, clarity_analysis: Dict) -> Dict[str, Any]:
    """Calculate overall language-specific performance score."""
    
    # Weighted combination of different aspects
    weights = {
        "pace": 0.3,
        "volume": 0.25, 
        "pitch": 0.25,
        "clarity": 0.2
    }
    
    overall_score = (
        weights["pace"] * pace_analysis["pace_score"] +
        weights["volume"] * volume_analysis["overall_score"] +
        weights["pitch"] * pitch_analysis["overall_score"] +
        weights["clarity"] * clarity_analysis["overall_score"]
    )
    
    # Performance level
    if overall_score >= 0.85:
        performance_level = "excellent"
    elif overall_score >= 0.7:
        performance_level = "good"
    elif overall_score >= 0.5:
        performance_level = "acceptable"
    else:
        performance_level = "needs_improvement"
    
    # Key strengths and weaknesses
    scores = {
        "pace": pace_analysis["pace_score"],
        "volume": volume_analysis["overall_score"],
        "pitch": pitch_analysis["overall_score"],
        "clarity": clarity_analysis["overall_score"]
    }
    
    strengths = [k for k, v in scores.items() if v >= 0.8]
    weaknesses = [k for k, v in scores.items() if v < 0.6]
    
    return {
        "overall_score": float(overall_score),
        "performance_level": performance_level,
        "component_scores": scores,
        "strengths": strengths,
        "areas_for_improvement": weaknesses,
        "weighted_breakdown": {
            "pace_contribution": float(weights["pace"] * pace_analysis["pace_score"]),
            "volume_contribution": float(weights["volume"] * volume_analysis["overall_score"]),
            "pitch_contribution": float(weights["pitch"] * pitch_analysis["overall_score"]),
            "clarity_contribution": float(weights["clarity"] * clarity_analysis["overall_score"])
        }
    }


def _empty_metrics() -> Dict[str, Any]:
    """Return empty metrics dict for error cases."""
    empty_data = {
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
    # Ensure all boolean values are properly serializable
    return serialize_response_data(empty_data)


def convert_audio_format(audio_data: bytes, 
                        target_format: str = "wav",
                        target_sample_rate: int = 16000) -> bytes:
    """
    Convert audio data to target format and sample rate using fallback methods.
    
    Args:
        audio_data: Input audio bytes
        target_format: Target audio format
        target_sample_rate: Target sample rate
        
    Returns:
        Converted audio bytes
    """
    try:
        # Load audio using fallback methods
        audio_array, current_sr = load_audio_with_fallbacks(audio_data, target_sample_rate)
        
        # Convert to target format - try soundfile first
        try:
            output_io = io.BytesIO()
            sf.write(output_io, audio_array, target_sample_rate, format=target_format.upper())
            return output_io.getvalue()
        except Exception as sf_error:
            logger.debug(f"soundfile export failed: {sf_error}")
            
            # Fallback to pydub if available
            if PYDUB_AVAILABLE and target_format.lower() == 'wav':
                try:
                    # Convert float32 array back to int16
                    int16_array = (audio_array * 32767).astype(np.int16)
                    
                    # Create AudioSegment
                    audio_segment = AudioSegment(
                        int16_array.tobytes(),
                        frame_rate=target_sample_rate,
                        sample_width=2,
                        channels=1
                    )
                    
                    # Export to BytesIO
                    output_io = io.BytesIO()
                    audio_segment.export(output_io, format=target_format)
                    return output_io.getvalue()
                    
                except Exception as pydub_error:
                    logger.debug(f"pydub export failed: {pydub_error}")
            
            # Fallback to basic WAV creation using wave library
            if target_format.lower() == 'wav':
                try:
                    output_io = io.BytesIO()
                    with wave.open(output_io, 'wb') as wav_file:
                        wav_file.setnchannels(1)  # Mono
                        wav_file.setsampwidth(2)  # 16-bit
                        wav_file.setframerate(target_sample_rate)
                        
                        # Convert to int16
                        int16_data = (audio_array * 32767).astype(np.int16)
                        wav_file.writeframes(int16_data.tobytes())
                    
                    return output_io.getvalue()
                    
                except Exception as wave_error:
                    logger.debug(f"wave export failed: {wave_error}")
            
            # Re-raise the original soundfile error if all fallbacks failed
            raise sf_error
        
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