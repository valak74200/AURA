"""
AURA Voice Analysis Processor

GenAI Processor for real-time voice analysis including pace, volume, clarity,
pitch analysis, and speech pattern detection using advanced audio processing.
"""

import asyncio
import json
from datetime import datetime
from typing import AsyncIterator, Dict, Any, List, Optional
import numpy as np

from genai_processors import Processor, ProcessorPart

from models.session import SessionConfig
from models.feedback import VoiceMetrics
from utils.logging import get_logger
from utils.audio_utils import analyze_voice_metrics
from utils.exceptions import ProcessorException
from app.config import get_settings

logger = get_logger(__name__)
settings = get_settings()


class AnalysisProcessor(Processor):
    """
    Processor that performs comprehensive voice analysis on audio streams.
    
    Analyzes voice characteristics including pace, volume, clarity, pitch,
    and provides real-time metrics for coaching feedback.
    """
    
    def __init__(self, config: SessionConfig):
        """
        Initialize analysis processor.
        
        Args:
            config: Session configuration
        """
        super().__init__()
        self.config = config
        self.sample_rate = settings.audio_sample_rate
        
        # Analysis state tracking
        self.processed_chunks = 0
        self.cumulative_metrics = {
            "total_duration": 0.0,
            "total_words": 0,
            "volume_readings": [],
            "pace_readings": [],
            "clarity_readings": [],
            "pitch_readings": []
        }
        
        # Analysis thresholds and parameters
        self.analysis_params = {
            "min_chunk_duration": 0.1,  # Minimum 100ms for meaningful analysis
            "volume_smoothing_factor": 0.3,
            "pace_window_size": 5,  # Number of chunks for pace averaging
            "quality_threshold": 0.6,  # Minimum quality for reliable metrics
        }
        
        logger.info(f"Initialized AnalysisProcessor with sample_rate: {self.sample_rate}")
    
    async def call(self, input_stream: AsyncIterator[ProcessorPart]) -> AsyncIterator[ProcessorPart]:
        """Call method required by Processor base class."""
        async for result in self.process(input_stream):
            yield result
    
    async def process(self, input_stream: AsyncIterator[ProcessorPart]) -> AsyncIterator[ProcessorPart]:
        """
        Process audio chunks and generate voice analysis results.
        
        Args:
            input_stream: Stream of audio chunks as ProcessorParts
            
        Yields:
            ProcessorPart: Analysis results with voice metrics
        """
        try:
            async for audio_part in input_stream:
                start_time = datetime.utcnow()
                
                # Validate audio part
                if not self._validate_audio_part(audio_part):
                    logger.warning(
                        "Invalid audio part received",
                        extra={"part_type": audio_part.metadata.get("type", "unknown"), "metadata": audio_part.metadata}
                    )
                    continue
                
                # Extract audio data or check for pre-analyzed data
                audio_data = self._extract_audio_data(audio_part)
                
                # Check if we have pre-analyzed data instead of raw audio
                if audio_data is None:
                    # This might be pre-analyzed data, try to extract it
                    if hasattr(audio_part, 'text') and audio_part.text:
                        try:
                            import json
                            analysis_results = json.loads(audio_part.text)
                            if isinstance(analysis_results, dict) and 'chunk_metrics' in analysis_results:
                                logger.info("Using pre-analyzed voice data", extra={"analysis_keys": list(analysis_results.keys())})
                                
                                # Update cumulative metrics
                                self._update_cumulative_metrics(analysis_results)
                                
                                # Create analysis result part
                                analysis_part = ProcessorPart(
                                    json.dumps(analysis_results) if isinstance(analysis_results, dict) else str(analysis_results),
                                    mimetype="application/json",
                                    metadata={
                                        **audio_part.metadata,
                                        "type": "voice_analysis",
                                        "processor": self.__class__.__name__,
                                        "analysis_timestamp": datetime.utcnow().isoformat(),
                                        "processing_time_ms": (datetime.utcnow() - start_time).total_seconds() * 1000,
                                        "chunk_number": self.processed_chunks,
                                        "pre_analyzed": True
                                    }
                                )
                                
                                self.processed_chunks += 1
                                yield analysis_part
                                continue
                        except (json.JSONDecodeError, KeyError):
                            pass
                    
                    # No valid audio data or pre-analyzed data found
                    logger.debug("No valid audio data found, skipping")
                    continue
                
                # Perform voice analysis on raw audio data
                try:
                    analysis_results = await self._analyze_voice_chunk(audio_data, audio_part.metadata)
                    
                    # Update cumulative metrics
                    self._update_cumulative_metrics(analysis_results)
                    
                    # Create analysis result part
                    analysis_part = ProcessorPart(
                        data=analysis_results,
                        type="voice_analysis",
                        metadata={
                            **audio_part.metadata,
                            "processor": self.__class__.__name__,
                            "analysis_timestamp": datetime.utcnow().isoformat(),
                            "processing_time_ms": (datetime.utcnow() - start_time).total_seconds() * 1000,
                            "chunk_number": self.processed_chunks
                        }
                    )
                    
                    self.processed_chunks += 1
                    
                    logger.debug(
                        "Voice analysis completed",
                        extra={
                            "chunk_number": self.processed_chunks,
                            "duration": analysis_results["chunk_metrics"]["duration"],
                            "pace_wpm": analysis_results["chunk_metrics"]["pace_wpm"]
                        }
                    )
                    
                    yield analysis_part
                    
                except Exception as e:
                    logger.error(
                        "Voice analysis failed",
                        extra={
                            "chunk_number": self.processed_chunks,
                            "error": str(e)
                        }
                    )
                    
                    # Yield error part
                    error_part = ProcessorPart(
                        data={"error": str(e), "chunk_number": self.processed_chunks},
                        type="analysis_error",
                        metadata={
                            **audio_part.metadata,
                            "processor": self.__class__.__name__,
                            "error_timestamp": datetime.utcnow().isoformat()
                        }
                    )
                    yield error_part
                    
        except Exception as e:
            logger.error(
                "Analysis processor error",
                extra={"error": str(e)},
                exc_info=True
            )
            raise ProcessorException("AnalysisProcessor", str(e))
    
    async def _analyze_voice_chunk(self, audio_data: np.ndarray, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze voice characteristics of an audio chunk.
        
        Args:
            audio_data: Audio samples as numpy array
            metadata: Chunk metadata
            
        Returns:
            Dict containing comprehensive voice analysis
        """
        # Perform core voice analysis using librosa
        voice_metrics = analyze_voice_metrics(audio_data, self.sample_rate)
        
        # Calculate advanced metrics
        advanced_metrics = await self._calculate_advanced_metrics(audio_data, voice_metrics)
        
        # Generate real-time insights
        realtime_insights = self._generate_realtime_insights(voice_metrics, advanced_metrics)
        
        # Calculate trend analysis
        trend_analysis = self._calculate_trend_analysis(voice_metrics)
        
        # Assess speech quality
        quality_assessment = self._assess_speech_quality(voice_metrics, advanced_metrics)
        
        return {
            "chunk_metrics": voice_metrics,
            "advanced_metrics": advanced_metrics,
            "realtime_insights": realtime_insights,
            "trend_analysis": trend_analysis,
            "quality_assessment": quality_assessment,
            "session_summary": self._generate_session_summary(),
            "analysis_metadata": {
                "processor_version": "1.0.0",
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "chunk_id": metadata.get("chunk_id"),
                "session_id": metadata.get("session_id")
            }
        }
    
    async def _calculate_advanced_metrics(self, audio_data: np.ndarray, base_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate advanced voice analysis metrics.
        
        Args:
            audio_data: Audio samples
            base_metrics: Basic voice metrics from analyze_voice_metrics
            
        Returns:
            Dict containing advanced metrics
        """
        return {
            # Speech rhythm and timing
            "speech_rhythm": self._analyze_speech_rhythm(audio_data),
            "pause_patterns": self._analyze_pause_patterns(base_metrics),
            "speech_continuity": self._calculate_speech_continuity(base_metrics),
            
            # Voice quality indicators
            "voice_stability": self._assess_voice_stability(base_metrics),
            "articulation_clarity": self._assess_articulation_clarity(base_metrics),
            "vocal_effort": self._estimate_vocal_effort(base_metrics),
            
            # Speaking patterns
            "filler_word_density": self._estimate_filler_density(base_metrics),
            "speech_variation": self._analyze_speech_variation(base_metrics),
            "emphasis_patterns": self._detect_emphasis_patterns(audio_data),
            
            # Confidence indicators
            "confidence_score": self._calculate_confidence_score(base_metrics),
            "nervousness_indicators": self._detect_nervousness_indicators(base_metrics)
        }
    
    def _analyze_speech_rhythm(self, audio_data: np.ndarray) -> Dict[str, float]:
        """Analyze speech rhythm and timing patterns."""
        # Simple rhythm analysis based on energy variations
        frame_length = int(0.025 * self.sample_rate)  # 25ms frames
        hop_length = int(0.010 * self.sample_rate)    # 10ms hop
        
        # Calculate frame energy
        frames = np.array([
            audio_data[i:i+frame_length] for i in range(0, len(audio_data)-frame_length, hop_length)
        ])
        energy = np.array([np.sum(frame**2) for frame in frames])
        
        # Rhythm metrics
        energy_var = float(np.var(energy)) if len(energy) > 1 else 0.0
        rhythm_regularity = 1.0 / (1.0 + energy_var)  # Higher = more regular rhythm
        
        return {
            "rhythm_regularity": rhythm_regularity,
            "energy_variance": energy_var,
            "rhythm_score": min(rhythm_regularity * 2, 1.0)  # Normalize to 0-1
        }
    
    def _analyze_pause_patterns(self, base_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze pause patterns and their effectiveness."""
        speech_segments = base_metrics.get("speech_segments", [])
        
        if not speech_segments or len(speech_segments) < 2:
            return {
                "pause_effectiveness": 0.5,
                "pause_frequency": 0.0,
                "average_pause_duration": 0.0,
                "pause_variability": 0.0
            }
        
        # Calculate pause durations between segments
        pause_durations = []
        for i in range(1, len(speech_segments)):
            prev_end = speech_segments[i-1][1]
            curr_start = speech_segments[i][0]
            if curr_start > prev_end:
                pause_durations.append(curr_start - prev_end)
        
        if not pause_durations:
            return {
                "pause_effectiveness": 0.5,
                "pause_frequency": 0.0,
                "average_pause_duration": 0.0,
                "pause_variability": 0.0
            }
        
        avg_pause = float(np.mean(pause_durations))
        pause_var = float(np.var(pause_durations))
        
        # Effective pauses are typically 0.2-0.8 seconds
        effectiveness = 1.0 - abs(avg_pause - 0.5) / 0.5 if avg_pause <= 1.0 else 0.3
        
        return {
            "pause_effectiveness": min(max(effectiveness, 0.0), 1.0),
            "pause_frequency": len(pause_durations) / base_metrics.get("duration", 1.0),
            "average_pause_duration": avg_pause,
            "pause_variability": pause_var
        }
    
    def _calculate_speech_continuity(self, base_metrics: Dict[str, Any]) -> float:
        """Calculate speech continuity score (0-1)."""
        voice_activity = base_metrics.get("voice_activity_ratio", 0.0)
        
        # Good continuity is around 0.7-0.9 (some pauses are good)
        if 0.7 <= voice_activity <= 0.9:
            return 1.0
        elif voice_activity < 0.7:
            return voice_activity / 0.7
        else:  # Too much talking without pauses
            return max(0.5, 1.0 - (voice_activity - 0.9) * 2)
    
    def _assess_voice_stability(self, base_metrics: Dict[str, Any]) -> float:
        """Assess voice stability based on pitch and volume consistency."""
        volume_consistency = base_metrics.get("volume_consistency", 0.0)
        pitch_variance = base_metrics.get("pitch_variance", 0.0)
        
        # Lower pitch variance indicates more stable voice
        pitch_stability = 1.0 / (1.0 + pitch_variance / 1000.0)  # Normalize
        
        return (volume_consistency + pitch_stability) / 2
    
    def _assess_articulation_clarity(self, base_metrics: Dict[str, Any]) -> float:
        """Assess articulation clarity."""
        clarity_score = base_metrics.get("clarity_score", 0.0)
        spectral_centroid = base_metrics.get("spectral_centroid", 0.0)
        
        # Higher spectral centroid often indicates clearer consonants
        centroid_score = min(spectral_centroid / 3000.0, 1.0)
        
        return (clarity_score + centroid_score) / 2
    
    def _estimate_vocal_effort(self, base_metrics: Dict[str, Any]) -> float:
        """Estimate vocal effort level (0-1, higher = more effort)."""
        avg_volume = base_metrics.get("avg_volume", 0.0)
        pitch_variance = base_metrics.get("pitch_variance", 0.0)
        
        # High volume + high pitch variance might indicate strain
        volume_effort = min(avg_volume * 10, 1.0)  # Normalize
        pitch_effort = min(pitch_variance / 2000.0, 1.0)
        
        return (volume_effort + pitch_effort) / 2
    
    def _estimate_filler_density(self, base_metrics: Dict[str, Any]) -> float:
        """Estimate filler word density."""
        # This is a simplified estimation - in a real system, 
        # you'd use speech recognition to detect actual filler words
        zcr = base_metrics.get("zero_crossing_rate", 0.0)
        duration = base_metrics.get("duration", 1.0)
        
        # High ZCR might indicate more "uh", "um" sounds
        estimated_fillers = zcr * duration * 5  # Rough estimate
        estimated_words = base_metrics.get("estimated_words", 1)
        
        return min(estimated_fillers / max(estimated_words, 1), 1.0)
    
    def _analyze_speech_variation(self, base_metrics: Dict[str, Any]) -> Dict[str, float]:
        """Analyze speech variation and dynamics."""
        pitch_variance = base_metrics.get("pitch_variance", 0.0)
        volume_consistency = base_metrics.get("volume_consistency", 0.0)
        
        # Good speakers have some variation but not too much
        pitch_variation = min(pitch_variance / 1000.0, 1.0)
        volume_variation = 1.0 - volume_consistency
        
        return {
            "pitch_variation": pitch_variation,
            "volume_variation": volume_variation,
            "overall_variation": (pitch_variation + volume_variation) / 2
        }
    
    def _detect_emphasis_patterns(self, audio_data: np.ndarray) -> Dict[str, Any]:
        """Detect emphasis and stress patterns in speech."""
        # Simplified emphasis detection based on energy peaks
        frame_length = int(0.050 * self.sample_rate)  # 50ms frames
        hop_length = int(0.025 * self.sample_rate)    # 25ms hop
        
        frames = np.array([
            audio_data[i:i+frame_length] for i in range(0, len(audio_data)-frame_length, hop_length)
        ])
        energy = np.array([np.sum(frame**2) for frame in frames])
        
        if len(energy) < 3:
            return {"emphasis_frequency": 0.0, "emphasis_strength": 0.0}
        
        # Find peaks (simple peak detection)
        mean_energy = np.mean(energy)
        threshold = mean_energy * 1.5
        peaks = energy > threshold
        
        emphasis_frequency = float(np.sum(peaks)) / len(energy)
        emphasis_strength = float(np.mean(energy[peaks])) / mean_energy if np.any(peaks) else 1.0
        
        return {
            "emphasis_frequency": emphasis_frequency,
            "emphasis_strength": min(emphasis_strength, 2.0) / 2.0  # Normalize
        }
    
    def _calculate_confidence_score(self, base_metrics: Dict[str, Any]) -> float:
        """Calculate overall confidence score based on voice characteristics."""
        # Confident speakers typically have:
        # - Consistent volume
        # - Appropriate pace
        # - Good voice activity ratio
        # - Clear articulation
        
        volume_consistency = base_metrics.get("volume_consistency", 0.0)
        pace_wpm = base_metrics.get("pace_wpm", 0.0)
        voice_activity = base_metrics.get("voice_activity_ratio", 0.0)
        clarity = base_metrics.get("clarity_score", 0.0)
        
        # Pace confidence (120-180 WPM is ideal)
        pace_confidence = 1.0 if 120 <= pace_wpm <= 180 else max(0.3, 1.0 - abs(pace_wpm - 150) / 150)
        
        # Voice activity confidence (0.6-0.8 is good)
        activity_confidence = 1.0 if 0.6 <= voice_activity <= 0.8 else max(0.3, 1.0 - abs(voice_activity - 0.7) / 0.7)
        
        # Weighted combination
        confidence = (
            0.3 * volume_consistency +
            0.25 * pace_confidence +
            0.25 * activity_confidence +
            0.2 * clarity
        )
        
        return min(max(confidence, 0.0), 1.0)
    
    def _detect_nervousness_indicators(self, base_metrics: Dict[str, Any]) -> Dict[str, float]:
        """Detect potential nervousness indicators."""
        pace_wpm = base_metrics.get("pace_wpm", 0.0)
        volume_consistency = base_metrics.get("volume_consistency", 0.0)
        pitch_variance = base_metrics.get("pitch_variance", 0.0)
        
        # Nervousness indicators:
        # - Speaking too fast or too slow
        # - Inconsistent volume
        # - High pitch variance
        
        pace_nervousness = 0.0
        if pace_wpm > 200:  # Too fast
            pace_nervousness = min((pace_wpm - 200) / 100, 1.0)
        elif pace_wpm < 80:  # Too slow
            pace_nervousness = min((80 - pace_wpm) / 40, 1.0)
        
        volume_nervousness = 1.0 - volume_consistency
        pitch_nervousness = min(pitch_variance / 2000.0, 1.0)
        
        overall_nervousness = (pace_nervousness + volume_nervousness + pitch_nervousness) / 3
        
        return {
            "pace_nervousness": pace_nervousness,
            "volume_nervousness": volume_nervousness,
            "pitch_nervousness": pitch_nervousness,
            "overall_nervousness": overall_nervousness
        }
    
    def _generate_realtime_insights(self, voice_metrics: Dict[str, Any], advanced_metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate real-time insights for immediate feedback."""
        insights = []
        
        # Pace insights
        pace_wpm = voice_metrics.get("pace_wpm", 0.0)
        if pace_wpm > 200:
            insights.append({
                "type": "pace",
                "severity": "warning",
                "message": "Vous parlez trop vite, ralentissez un peu",
                "metric_value": pace_wpm,
                "suggestion": "Prenez des pauses plus longues entre les phrases"
            })
        elif pace_wpm < 100:
            insights.append({
                "type": "pace",
                "severity": "info",
                "message": "Vous pouvez parler un peu plus rapidement",
                "metric_value": pace_wpm,
                "suggestion": "Augmentez légèrement votre débit de parole"
            })
        
        # Volume insights
        volume_consistency = voice_metrics.get("volume_consistency", 0.0)
        if volume_consistency < 0.6:
            insights.append({
                "type": "volume",
                "severity": "warning",
                "message": "Maintenez un volume plus constant",
                "metric_value": volume_consistency,
                "suggestion": "Concentrez-vous sur un niveau de voix régulier"
            })
        
        # Clarity insights
        clarity_score = voice_metrics.get("clarity_score", 0.0)
        if clarity_score < 0.6:
            insights.append({
                "type": "clarity",
                "severity": "warning",
                "message": "Articulez plus clairement",
                "metric_value": clarity_score,
                "suggestion": "Ouvrez plus la bouche et prononcez distinctement"
            })
        
        # Confidence insights
        confidence_score = advanced_metrics.get("confidence_score", 0.0)
        if confidence_score > 0.8:
            insights.append({
                "type": "confidence",
                "severity": "success",
                "message": "Excellente confiance dans votre voix",
                "metric_value": confidence_score,
                "suggestion": "Continuez sur cette lancée"
            })
        
        return insights
    
    def _calculate_trend_analysis(self, current_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate trends based on historical data."""
        # Update historical data
        self.cumulative_metrics["pace_readings"].append(current_metrics.get("pace_wpm", 0.0))
        self.cumulative_metrics["volume_readings"].append(current_metrics.get("avg_volume", 0.0))
        self.cumulative_metrics["clarity_readings"].append(current_metrics.get("clarity_score", 0.0))
        
        # Keep only recent readings (sliding window)
        window_size = 10
        for key in ["pace_readings", "volume_readings", "clarity_readings"]:
            if len(self.cumulative_metrics[key]) > window_size:
                self.cumulative_metrics[key] = self.cumulative_metrics[key][-window_size:]
        
        trends = {}
        for metric_name, readings in [
            ("pace", self.cumulative_metrics["pace_readings"]),
            ("volume", self.cumulative_metrics["volume_readings"]),
            ("clarity", self.cumulative_metrics["clarity_readings"])
        ]:
            if len(readings) >= 3:
                # Simple trend calculation
                recent_avg = np.mean(readings[-3:])
                older_avg = np.mean(readings[:-3]) if len(readings) > 3 else recent_avg
                trend = "improving" if recent_avg > older_avg else "declining" if recent_avg < older_avg else "stable"
                trends[f"{metric_name}_trend"] = trend
                trends[f"{metric_name}_change"] = float(recent_avg - older_avg)
            else:
                trends[f"{metric_name}_trend"] = "insufficient_data"
                trends[f"{metric_name}_change"] = 0.0
        
        return trends
    
    def _assess_speech_quality(self, voice_metrics: Dict[str, Any], advanced_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Assess overall speech quality."""
        quality_scores = {
            "technical_quality": voice_metrics.get("clarity_score", 0.0),
            "delivery_quality": advanced_metrics.get("confidence_score", 0.0),
            "consistency_quality": voice_metrics.get("volume_consistency", 0.0),
            "pace_quality": self._assess_pace_quality(voice_metrics.get("pace_wpm", 0.0))
        }
        
        overall_quality = sum(quality_scores.values()) / len(quality_scores)
        
        return {
            **quality_scores,
            "overall_quality": overall_quality,
            "quality_grade": self._get_quality_grade(overall_quality)
        }
    
    def _assess_pace_quality(self, pace_wpm: float) -> float:
        """Assess pace quality (0-1)."""
        if 120 <= pace_wpm <= 180:
            return 1.0
        elif 100 <= pace_wpm < 120 or 180 < pace_wpm <= 200:
            return 0.8
        elif 80 <= pace_wpm < 100 or 200 < pace_wpm <= 220:
            return 0.6
        else:
            return 0.4
    
    def _get_quality_grade(self, quality_score: float) -> str:
        """Convert quality score to grade."""
        if quality_score >= 0.9:
            return "Excellent"
        elif quality_score >= 0.8:
            return "Très bien"
        elif quality_score >= 0.7:
            return "Bien"
        elif quality_score >= 0.6:
            return "Correct"
        else:
            return "À améliorer"
    
    def _generate_session_summary(self) -> Dict[str, Any]:
        """Generate summary of the current session."""
        return {
            "chunks_processed": self.processed_chunks,
            "total_duration": self.cumulative_metrics["total_duration"],
            "total_words": self.cumulative_metrics["total_words"],
            "average_metrics": {
                "pace": float(np.mean(self.cumulative_metrics["pace_readings"])) if self.cumulative_metrics["pace_readings"] else 0.0,
                "volume": float(np.mean(self.cumulative_metrics["volume_readings"])) if self.cumulative_metrics["volume_readings"] else 0.0,
                "clarity": float(np.mean(self.cumulative_metrics["clarity_readings"])) if self.cumulative_metrics["clarity_readings"] else 0.0
            }
        }
    
    def _validate_audio_part(self, audio_part: ProcessorPart) -> bool:
        """Validate audio part for processing."""
        if audio_part.metadata.get("type") != "audio_chunk":
            return False
        
        # Check if audio part has data in any form
        has_data = (
            (hasattr(audio_part, 'data') and audio_part.data is not None) or
            (hasattr(audio_part, 'part') and audio_part.part is not None) or
            (hasattr(audio_part, 'text') and audio_part.text is not None)
        )
        
        if not has_data:
            return False
        
        return True
    
    def _extract_audio_data(self, audio_part: ProcessorPart) -> Optional[np.ndarray]:
        """Extract numpy audio data from ProcessorPart (compatible with Google GenAI Processors)."""
        try:
            # For Google GenAI Processors, we need to handle google.genai.types.Part
            # Check if this is a voice analysis result (JSON data) rather than raw audio
            if hasattr(audio_part, 'text') and audio_part.text:
                try:
                    import json
                    # Try to parse as JSON - this might be voice analysis results
                    analysis_data = json.loads(audio_part.text)
                    if isinstance(analysis_data, dict) and 'chunk_metrics' in analysis_data:
                        # This is already analyzed data, not raw audio
                        # We can work with the metrics directly
                        logger.info("Received pre-analyzed voice data, using existing metrics")
                        return None  # Signal that we have analysis data, not raw audio
                except json.JSONDecodeError:
                    # Not JSON, might be raw audio data as text
                    pass
            
            # Try to access audio data from different sources
            audio_data = None
            
            # For GenAI ProcessorPart, try different access methods
            if hasattr(audio_part, 'data') and audio_part.data is not None:
                audio_data = audio_part.data
            elif hasattr(audio_part, 'text') and audio_part.text is not None:
                audio_data = audio_part.text
            elif hasattr(audio_part, 'part') and audio_part.part is not None:
                # This might be the google.genai.types.Part
                genai_part = audio_part.part
                if hasattr(genai_part, 'data') and genai_part.data is not None:
                    audio_data = genai_part.data
                elif hasattr(genai_part, 'text') and genai_part.text is not None:
                    audio_data = genai_part.text
                else:
                    logger.warning(f"GenAI Part type not supported: {type(genai_part)}")
                    return None
            else:
                logger.warning("No accessible data found in ProcessorPart")
                return None
            
            # Handle different data formats
            if isinstance(audio_data, np.ndarray):
                return audio_data
            elif isinstance(audio_data, (list, tuple)):
                return np.array(audio_data, dtype=np.float32)
            elif isinstance(audio_data, bytes):
                # Convert bytes to numpy array (assuming they are uint8 audio samples)
                try:
                    # Convert bytes to float32 array normalized to [-1, 1]
                    audio_array = np.frombuffer(audio_data, dtype=np.uint8)
                    return (audio_array.astype(np.float32) - 127.5) / 127.5
                except Exception as e:
                    logger.warning(f"Failed to convert bytes to audio array: {e}")
                    return None
            elif isinstance(audio_data, str):
                # If it's a base64 string, try to decode it
                try:
                    import base64
                    audio_bytes = base64.b64decode(audio_data)
                    # Convert bytes to numpy array
                    audio_array = np.frombuffer(audio_bytes, dtype=np.uint8)
                    return (audio_array.astype(np.float32) - 127.5) / 127.5
                except Exception as e:
                    logger.warning(f"Failed to decode base64 audio data: {e}")
                    return None
            else:
                logger.debug(f"Unsupported audio data type: {type(audio_data)}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to extract audio data: {e}")
            return None
    
    def _update_cumulative_metrics(self, analysis_results: Dict[str, Any]):
        """Update cumulative metrics with new analysis results."""
        chunk_metrics = analysis_results.get("chunk_metrics", {})
        
        self.cumulative_metrics["total_duration"] += chunk_metrics.get("duration", 0.0)
        self.cumulative_metrics["total_words"] += chunk_metrics.get("estimated_words", 0) 