"""
AURA Audio Processing Service

Service for real-time audio processing, analysis, and format conversion
using librosa and advanced voice analysis techniques.
"""

import asyncio
import io
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
import numpy as np

from utils.logging import get_logger
from utils.audio_utils import (
    AudioBuffer, 
    analyze_voice_metrics, 
    convert_audio_format,
    process_audio_stream_async,
    validate_audio_data,
    detect_audio_format,
    load_audio_with_fallbacks,
    PYDUB_AVAILABLE,
    SCIPY_AVAILABLE
)
from utils.exceptions import (
    AudioProcessingException,
    InvalidAudioFormatError,
    AudioTooLargeError
)
from utils.json_encoder import serialize_response_data
from app.config import get_settings
from models.session import SupportedLanguage

logger = get_logger(__name__)
settings = get_settings()


class AudioService:
    """
    Service for comprehensive audio processing operations.
    
    Handles real-time audio analysis, format conversion, voice metrics extraction,
    and streaming audio processing for presentation coaching.
    """
    
    def __init__(self):
        self.logger = logger
        self.active_buffers: Dict[str, AudioBuffer] = {}
        self.processing_stats = {
            "total_files_processed": 0,
            "total_chunks_analyzed": 0,
            "average_processing_time": 0.0,
            "errors_count": 0
        }
        
        logger.info("AudioService initialized")
    
    async def process_audio_file(self, 
                                audio_data: bytes, 
                                filename: str,
                                session_id: Optional[str] = None,
                                language: SupportedLanguage = SupportedLanguage.FRENCH) -> Dict[str, Any]:
        """
        Process uploaded audio file with comprehensive voice analysis.
        
        Args:
            audio_data: Raw audio file bytes
            filename: Original filename
            session_id: Optional session identifier
            language: Target language for analysis adaptation
            
        Returns:
            Dict containing processing results and voice metrics
        """
        start_time = datetime.utcnow()
        
        try:
            # Comprehensive audio validation with detailed error reporting
            validation_result = validate_audio_data(
                audio_data, 
                max_size=settings.max_audio_file_size
            )
            
            if not validation_result["valid"]:
                if "too large" in validation_result["error"].lower():
                    file_size = validation_result.get("size_bytes", len(audio_data))
                    max_size = settings.max_audio_file_size
                    raise AudioTooLargeError(file_size, max_size)
                elif "empty" in validation_result["error"].lower():
                    raise AudioProcessingException("Audio file is empty")
                else:
                    raise AudioProcessingException(validation_result["error"])
            
            # Log validation warnings if any
            if validation_result["warnings"]:
                for warning in validation_result["warnings"]:
                    logger.warning(f"Audio validation warning: {warning}")
            
            # Get detected format info
            detected_format = validation_result["format"]
            file_extension = filename.split('.')[-1].lower() if '.' in filename else detected_format
            
            logger.info(
                f"Processing audio file: {filename} ({file_extension}) - "
                f"Detected: {detected_format}, Size: {validation_result['size_bytes']} bytes, "
                f"Duration: {validation_result.get('duration_seconds', 'unknown')}s"
            )
            
            # Load audio using fallback methods (already validated, so should work)
            try:
                full_audio, actual_sample_rate = load_audio_with_fallbacks(
                    audio_data,
                    target_sample_rate=settings.audio_sample_rate
                )
                
                # Convert to standard format for compatibility
                converted_audio = convert_audio_format(
                    audio_data,
                    target_format="wav",
                    target_sample_rate=settings.audio_sample_rate
                )
                
            except Exception as e:
                logger.error(f"Audio loading/conversion failed: {e}")
                raise AudioProcessingException(f"Audio processing failed with enhanced methods: {e}")
            
            # Verify we have usable audio data
            if full_audio is None or len(full_audio) == 0:
                raise AudioProcessingException("No usable audio data after processing")
            
            # Perform comprehensive voice analysis with language adaptation
            voice_metrics = analyze_voice_metrics(full_audio, settings.audio_sample_rate, language)
            
            # Calculate additional metrics
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Update processing stats
            self.processing_stats["total_files_processed"] += 1
            self.processing_stats["average_processing_time"] = (
                (self.processing_stats["average_processing_time"] * 
                 (self.processing_stats["total_files_processed"] - 1) + processing_time) /
                self.processing_stats["total_files_processed"]
            )
            
            result = {
                "status": "success",
                "filename": filename,
                "original_size": len(audio_data),
                "converted_size": len(converted_audio),
                "processing_time_ms": processing_time,
                "audio_info": {
                    "duration_seconds": voice_metrics["duration"],
                    "sample_rate": settings.audio_sample_rate,
                    "format": "wav",
                    "channels": 1,  # Always mono
                    "detected_format": detected_format,
                    "original_format": file_extension,
                    "validation_warnings": validation_result.get("warnings", [])
                },
                "voice_metrics": voice_metrics,
                "quality_indicators": self._calculate_quality_indicators(voice_metrics),
                "session_id": session_id,
                "timestamp": datetime.utcnow().isoformat(),
                "processing_methods_available": {
                    "soundfile": bool(True),
                    "pydub": bool(PYDUB_AVAILABLE),
                    "scipy": bool(SCIPY_AVAILABLE),
                    "wave": bool(True),
                    "raw_pcm": bool(True)
                }
            }
            
            logger.info(
                f"Audio file processed successfully: {filename}, duration: {voice_metrics['duration']}s, "
                f"processing_time: {processing_time}ms, session: {session_id}"
            )
            
            # Ensure all boolean values are properly serializable
            return serialize_response_data(result)
            
        except (AudioTooLargeError, InvalidAudioFormatError, AudioProcessingException) as e:
            self.processing_stats["errors_count"] += 1
            logger.error(f"Audio processing failed: {e}")
            raise
        except Exception as e:
            self.processing_stats["errors_count"] += 1
            logger.error(f"Unexpected audio processing error: {e}")
            raise AudioProcessingException(f"Unexpected processing error: {e}")
    
    async def create_audio_stream(self, session_id: str) -> AudioBuffer:
        """
        Create audio buffer for streaming processing.
        
        Args:
            session_id: Session identifier
            
        Returns:
            AudioBuffer instance for the session
        """
        try:
            audio_buffer = AudioBuffer(
                sample_rate=settings.audio_sample_rate,
                chunk_size=settings.audio_chunk_size,
                max_buffer_seconds=30.0  # Longer buffer for streaming
            )
            
            self.active_buffers[session_id] = audio_buffer
            
            logger.info(
                "Created audio stream buffer",
                extra={"session_id": session_id}
            )
            
            return audio_buffer
            
        except (ValueError, MemoryError) as e:
            logger.error(f"Failed to create audio stream: {e}")
            raise AudioProcessingException(f"Stream creation failed: {e}")
        except Exception as e:
            logger.error(f"Unexpected stream creation error: {e}")
            raise AudioProcessingException(f"Stream creation failed: {e}")
    
    async def process_audio_chunk(self, 
                                 session_id: str,
                                 chunk_data: bytes,
                                 chunk_index: int = 0,
                                 language: SupportedLanguage = SupportedLanguage.FRENCH) -> Dict[str, Any]:
        """
        Process individual audio chunk for real-time analysis.
        
        Args:
            session_id: Session identifier
            chunk_data: Raw audio chunk bytes
            chunk_index: Index of the chunk in the stream
            
        Returns:
            Dict containing chunk analysis results
        """
        start_time = datetime.utcnow()
        
        try:
            # Get or create audio buffer for session
            if session_id not in self.active_buffers:
                await self.create_audio_stream(session_id)
            
            audio_buffer = self.active_buffers[session_id]
            
            # Add chunk to buffer
            if not audio_buffer.add_chunk(chunk_data):
                raise AudioProcessingException("Failed to add chunk to buffer")
            
            # Get chunk for analysis (if enough data available)
            chunk_size = settings.audio_chunk_size
            audio_chunk = audio_buffer.peek_chunk(chunk_size)
            
            if audio_chunk is None:
                # Not enough data yet, return partial result
                buffering_result = {
                    "status": "buffering",
                    "chunk_index": chunk_index,
                    "buffer_size": audio_buffer.available_samples(),
                    "required_size": chunk_size,
                    "session_id": session_id
                }
                return serialize_response_data(buffering_result)
            
            # Analyze chunk with language adaptation
            voice_metrics = analyze_voice_metrics(audio_chunk, settings.audio_sample_rate, language)
            
            # Calculate processing time
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Update stats
            self.processing_stats["total_chunks_analyzed"] += 1
            
            result = {
                "status": "processed",
                "chunk_index": chunk_index,
                "session_id": session_id,
                "processing_time_ms": processing_time,
                "chunk_info": {
                    "size_bytes": len(chunk_data),
                    "samples": len(audio_chunk),
                    "duration_ms": len(audio_chunk) / settings.audio_sample_rate * 1000
                },
                "voice_metrics": voice_metrics,
                "real_time_indicators": self._extract_realtime_indicators(voice_metrics),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Ensure all boolean values are properly serializable
            return serialize_response_data(result)
            
        except AudioProcessingException:
            raise
        except (ValueError, MemoryError, IndexError) as e:
            logger.error(f"Chunk processing failed: {e}")
            raise AudioProcessingException(f"Chunk processing error: {e}")
        except Exception as e:
            logger.error(f"Unexpected chunk processing error: {e}")
            raise AudioProcessingException(f"Chunk processing error: {e}")
    
    async def cleanup_session(self, session_id: str) -> bool:
        """
        Clean up audio processing resources for a session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            True if cleanup successful
        """
        try:
            if session_id in self.active_buffers:
                del self.active_buffers[session_id]
                logger.info(f"Cleaned up audio resources for session {session_id}")
            
            return bool(True)
            
        except Exception as e:
            logger.error(f"Cleanup failed for session {session_id}: {e}")
            return bool(False)

    # Backwards-compat alias used by some tests
    async def cleanup_audio_stream(self, session_id: str) -> bool:
        """
        Alias to cleanup_session for compatibility with older test suites.
        """
        return await self.cleanup_session(session_id)
    
    async def get_processing_stats(self) -> Dict[str, Any]:
        """Get audio processing statistics."""
        return {
            **self.processing_stats,
            "active_sessions": len(self.active_buffers),
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def _calculate_quality_indicators(self, voice_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate audio quality indicators from voice metrics.
        
        Args:
            voice_metrics: Voice analysis results
            
        Returns:
            Dict containing quality indicators
        """
        return {
            "overall_quality": self._calculate_overall_quality(voice_metrics),
            "volume_quality": self._assess_volume_quality(voice_metrics),
            "clarity_quality": voice_metrics.get("clarity_score", 0.0),
            "pace_quality": self._assess_pace_quality(voice_metrics),
            "consistency_quality": voice_metrics.get("volume_consistency", 0.0),
            "recommendations": self._generate_quality_recommendations(voice_metrics)
        }
    
    def _calculate_overall_quality(self, voice_metrics: Dict[str, Any]) -> float:
        """Calculate overall audio quality score (0-1)."""
        clarity = voice_metrics.get("clarity_score", 0.0)
        volume_consistency = voice_metrics.get("volume_consistency", 0.0)
        voice_activity = voice_metrics.get("voice_activity_ratio", 0.0)
        
        # Weighted average
        overall = (0.4 * clarity + 0.3 * volume_consistency + 0.3 * voice_activity)
        return min(max(overall, 0.0), 1.0)
    
    def _assess_volume_quality(self, voice_metrics: Dict[str, Any]) -> float:
        """Assess volume quality based on consistency and level."""
        avg_volume = voice_metrics.get("avg_volume", 0.0)
        consistency = voice_metrics.get("volume_consistency", 0.0)
        
        # Ideal volume range: 0.01 to 0.1 (rough estimates)
        volume_score = 1.0 if 0.01 <= avg_volume <= 0.1 else max(0.0, 1.0 - abs(avg_volume - 0.05) * 10)
        
        return (volume_score + consistency) / 2
    
    def _assess_pace_quality(self, voice_metrics: Dict[str, Any]) -> float:
        """Assess speaking pace quality."""
        pace_wpm = voice_metrics.get("pace_wpm", 0.0)
        
        # Ideal pace: 120-180 WPM
        if 120 <= pace_wpm <= 180:
            return 1.0
        elif 100 <= pace_wpm < 120 or 180 < pace_wpm <= 200:
            return 0.8
        elif 80 <= pace_wpm < 100 or 200 < pace_wpm <= 220:
            return 0.6
        else:
            return 0.4
    
    def _generate_quality_recommendations(self, voice_metrics: Dict[str, Any]) -> List[str]:
        """Generate quality improvement recommendations."""
        recommendations = []
        
        # Volume recommendations
        avg_volume = voice_metrics.get("avg_volume", 0.0)
        if avg_volume < 0.01:
            recommendations.append("Speak louder - your voice is too quiet")
        elif avg_volume > 0.1:
            recommendations.append("Speak softer - your voice is too loud")
        
        # Consistency recommendations
        consistency = voice_metrics.get("volume_consistency", 0.0)
        if consistency < 0.7:
            recommendations.append("Try to maintain more consistent volume")
        
        # Pace recommendations
        pace_wpm = voice_metrics.get("pace_wpm", 0.0)
        if pace_wpm < 100:
            recommendations.append("Speak faster - your pace is too slow")
        elif pace_wpm > 200:
            recommendations.append("Speak slower - your pace is too fast")
        
        # Clarity recommendations
        clarity = voice_metrics.get("clarity_score", 0.0)
        if clarity < 0.6:
            recommendations.append("Focus on articulation for clearer speech")
        
        return recommendations
    
    def _extract_realtime_indicators(self, voice_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Extract indicators suitable for real-time feedback."""
        return {
            "volume_level": voice_metrics.get("avg_volume", 0.0),
            "pace_wpm": voice_metrics.get("pace_wpm", 0.0),
            "clarity_score": voice_metrics.get("clarity_score", 0.0),
            "voice_activity": voice_metrics.get("voice_activity_ratio", 0.0),
            "pitch_level": voice_metrics.get("avg_pitch", 0.0),
            "energy_level": voice_metrics.get("avg_volume", 0.0)
        } 