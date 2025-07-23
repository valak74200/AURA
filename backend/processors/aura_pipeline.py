"""
AURA Main GenAI Processors Pipeline

Complete pipeline orchestrating real-time audio processing, voice analysis,
AI feedback generation, and performance metrics with streaming optimization.
"""

import asyncio
from datetime import datetime
from typing import AsyncIterator, Dict, Any, Optional, List
from uuid import UUID
import json

from genai_processors import Processor, ProcessorPart
from genai_processors import streams

from models.session import PresentationSessionData, SupportedLanguage
from models.feedback import RealTimeFeedback, SessionFeedback
from app.config import get_settings
from utils.logging import get_logger
from processors.feedback_processor import FeedbackProcessor
from processors.analysis_processor import AnalysisProcessor
from processors.metrics_processor import MetricsProcessor
from utils.exceptions import ProcessorException, PipelineException
from services.audio_service import AudioService
from utils.language_config import get_language_config, get_ui_message

logger = get_logger(__name__)
settings = get_settings()


class AuraPipeline(Processor):
    """
    Main AURA pipeline orchestrating comprehensive presentation coaching.
    
    Coordinates audio analysis, AI feedback generation, and performance metrics
    with real-time streaming and intelligent routing for optimal coaching experience.
    """
    
    def __init__(self, session: PresentationSessionData):
        """
        Initialize the complete AURA pipeline with multilingual support.
        
        Args:
            session: The presentation session configuration and state
        """
        super().__init__()
        self.session = session
        self.session_id = session.id
        self.config = session.config
        self.language = session.config.language if session.config else SupportedLanguage.FRENCH
        self.language_config = get_language_config(self.language)
        
        # Initialize all processors
        self.analysis_processor = AnalysisProcessor(session.config)
        self.feedback_processor = FeedbackProcessor(session.config)
        self.metrics_processor = MetricsProcessor(session.config)
        
        # Initialize audio service for preprocessing
        self.audio_service = AudioService()
        
        # Pipeline orchestration state
        self.processed_chunks = 0
        self.total_processing_time = 0.0
        self.start_time = datetime.utcnow()
        self.pipeline_stats = {
            "chunks_processed": 0,
            "analysis_time_ms": 0.0,
            "feedback_time_ms": 0.0,
            "metrics_time_ms": 0.0,
            "total_pipeline_time_ms": 0.0,
            "errors_count": 0,
            "success_rate": 1.0
        }
        
        # Real-time feedback aggregation
        self.feedback_aggregator = FeedbackAggregator()
        self.metrics_aggregator = MetricsAggregator()
        
        # Pipeline configuration
        self.pipeline_config = {
            "enable_parallel_processing": True,
            "chunk_timeout_seconds": 5.0,
            "error_retry_count": 2,
            "feedback_throttling": True,
            "metrics_calculation_interval": 3,  # Every 3 chunks
            "quality_threshold": 0.5  # Minimum quality for processing
        }
        
        logger.info(
            f"Initialized complete AURA pipeline for session {self.session_id} with config: {self.config}"
        )
    
    async def call(self, input_stream: AsyncIterator[ProcessorPart]) -> AsyncIterator[ProcessorPart]:
        """
        Call method required by Processor base class.
        Delegates to the process method.
        """
        async for result in self.process(input_stream):
            yield result
    
    async def process(self, input_stream: AsyncIterator[ProcessorPart]) -> AsyncIterator[ProcessorPart]:
        """
        Main pipeline processing with intelligent orchestration.
        
        Args:
            input_stream: Stream of audio chunks as ProcessorParts
            
        Yields:
            ProcessorPart: Comprehensive coaching results including analysis, feedback, and metrics
        """
        try:
            async for audio_part in input_stream:
                pipeline_start_time = datetime.utcnow()
                
                # Validate and preprocess audio part
                if not await self._validate_audio_part(audio_part):
                    logger.debug("Skipping invalid audio part")
                    continue
                
                try:
                    # Generate unique chunk ID for tracking
                    chunk_id = f"{self.session_id}_{self.processed_chunks}_{int(datetime.utcnow().timestamp())}"
                    
                    # Enhance audio part metadata
                    enhanced_audio_part = ProcessorPart(
                        audio_part.part,  # Use .part for raw audio data
                        mimetype="audio/wav", # Assuming audio is in WAV format
                        metadata={
                            **audio_part.metadata,
                            "chunk_id": chunk_id,
                            "session_id": str(self.session_id),
                            "chunk_number": self.processed_chunks,
                            "pipeline_timestamp": datetime.utcnow().isoformat(),
                            "processing_priority": self._calculate_processing_priority(audio_part),
                            "type": "audio_chunk"  # Move type to metadata
                        }
                    )
                    
                    # Process through the complete pipeline
                    if self.pipeline_config["enable_parallel_processing"]:
                        # Parallel processing for better performance
                        results = await self._process_parallel(enhanced_audio_part)
                    else:
                        # Sequential processing for debugging/reliability
                        results = await self._process_sequential(enhanced_audio_part)
                    
                    # Aggregate and yield comprehensive results
                    async for result_part in self._aggregate_and_yield_results(results, enhanced_audio_part):
                        yield result_part
                    
                    # Update pipeline statistics
                    processing_time = (datetime.utcnow() - pipeline_start_time).total_seconds() * 1000
                    self._update_pipeline_stats(processing_time, success=True)
                    
                    self.processed_chunks += 1
                    
                    logger.debug(
                        "Pipeline processing completed",
                        extra={
                            "chunk_id": chunk_id,
                            "chunk_number": self.processed_chunks,
                            "processing_time_ms": processing_time,
                            "session_id": str(self.session_id)
                        }
                    )
                    
                except Exception as e:
                    # Handle processing errors gracefully
                    error_time = (datetime.utcnow() - pipeline_start_time).total_seconds() * 1000
                    self._update_pipeline_stats(error_time, success=False)
                    
                    logger.error(
                        "Pipeline processing error",
                        extra={
                            "chunk_number": self.processed_chunks,
                            "error": str(e),
                            "session_id": str(self.session_id)
                        }
                    )
                    
                    # Yield error result with fallback data
                    error_part = await self._create_error_result(audio_part, e)
                    yield error_part
                    
        except Exception as e:
            logger.error(
                "Critical pipeline error",
                extra={"error": str(e), "session_id": str(self.session_id)},
                exc_info=True
            )
            raise PipelineException(f"AURA pipeline failed: {e}")
    
    async def _validate_audio_part(self, audio_part: ProcessorPart) -> bool:
        """Validate audio part for processing."""
        if audio_part.metadata.get("type") not in ["audio_chunk", "audio"]:
            return False
        
        if audio_part.part is None:  # Check .part for raw data
            return False
        
        return True
    
    def _calculate_processing_priority(self, audio_part: ProcessorPart) -> str:
        """Calculate processing priority based on audio characteristics."""
        # Default priority
        priority = "normal"
        
        # Check for silence or low activity
        if hasattr(audio_part, 'metadata') and audio_part.metadata:
            voice_activity = audio_part.metadata.get('voice_activity_ratio', 1.0)
            if voice_activity < 0.3:
                priority = "low"  # Mostly silence
            elif voice_activity > 0.8:
                priority = "high"  # High activity
        
        return priority
    
    async def _process_parallel(self, audio_part: ProcessorPart) -> Dict[str, Any]:
        """Process audio part through all processors in parallel."""
        results = {}
        
        try:
            # Create tasks for parallel processing
            analysis_task = asyncio.create_task(
                self._run_processor_safely(self.analysis_processor, audio_part, "analysis")
            )
            
            # Start analysis first, then chain feedback and metrics
            analysis_result = await analysis_task
            results["analysis"] = analysis_result
            
            if analysis_result and not analysis_result.get("error"):
                # Create analysis part for downstream processors
                analysis_part = ProcessorPart(
                    json.dumps(analysis_result) if isinstance(analysis_result, dict) else str(analysis_result),
                    mimetype="application/json",
                    metadata={
                        **audio_part.metadata,
                        "type": "voice_analysis"
                    }
                )
                
                # Run feedback and metrics in parallel
                feedback_task = asyncio.create_task(
                    self._run_processor_safely(self.feedback_processor, analysis_part, "feedback")
                )
                
                # Run metrics every N chunks or if it's a significant analysis
                should_run_metrics = (
                    self.processed_chunks % self.pipeline_config["metrics_calculation_interval"] == 0 or
                    analysis_result.get("quality_assessment", {}).get("overall_quality", 0) > 0.8
                )
                
                if should_run_metrics:
                    metrics_task = asyncio.create_task(
                        self._run_processor_safely(self.metrics_processor, analysis_part, "metrics")
                    )
                    
                    # Wait for both feedback and metrics
                    feedback_result, metrics_result = await asyncio.gather(
                        feedback_task, metrics_task, return_exceptions=True
                    )
                    
                    results["feedback"] = feedback_result if not isinstance(feedback_result, Exception) else {"error": str(feedback_result)}
                    results["metrics"] = metrics_result if not isinstance(metrics_result, Exception) else {"error": str(metrics_result)}
                else:
                    # Only wait for feedback
                    feedback_result = await feedback_task
                    results["feedback"] = feedback_result if not isinstance(feedback_result, Exception) else {"error": str(feedback_result)}
                    results["metrics"] = None
            
        except Exception as e:
            logger.error(f"Parallel processing error: {e}")
            results["error"] = str(e)
        
        return results
    
    async def _process_sequential(self, audio_part: ProcessorPart) -> Dict[str, Any]:
        """Process audio part through processors sequentially."""
        results = {}
        
        try:
            # Step 1: Voice Analysis
            analysis_result = await self._run_processor_safely(
                self.analysis_processor, audio_part, "analysis"
            )
            results["analysis"] = analysis_result
            
            if analysis_result and not analysis_result.get("error"):
                # Create analysis part for downstream
                analysis_part = ProcessorPart(
                    json.dumps(analysis_result) if isinstance(analysis_result, dict) else str(analysis_result),
                    mimetype="application/json",
                    metadata={
                        **audio_part.metadata,
                        "type": "voice_analysis"
                    }
                )
                
                # Step 2: Feedback Generation
                feedback_result = await self._run_processor_safely(
                    self.feedback_processor, analysis_part, "feedback"
                )
                results["feedback"] = feedback_result
                
                # Step 3: Metrics Calculation (conditional)
                should_run_metrics = (
                    self.processed_chunks % self.pipeline_config["metrics_calculation_interval"] == 0
                )
                
                if should_run_metrics:
                    metrics_result = await self._run_processor_safely(
                        self.metrics_processor, analysis_part, "metrics"
                    )
                    results["metrics"] = metrics_result
                else:
                    results["metrics"] = None
            
        except Exception as e:
            logger.error(f"Sequential processing error: {e}")
            results["error"] = str(e)
        
        return results
    
    async def _run_processor_safely(self, processor: Processor, input_part: ProcessorPart, processor_name: str) -> Optional[Dict[str, Any]]:
        """Run a processor with error handling and timeout."""
        try:
            # Create timeout for processor
            timeout = self.pipeline_config["chunk_timeout_seconds"]
            
            # Run processor with timeout
            async with asyncio.timeout(timeout):
                results = []
                async for result_part in processor.process(streams.stream_content([input_part])):
                    results.append(result_part.text)
                
                # Return the first (and typically only) result
                return results[0] if results else None
                
        except asyncio.TimeoutError:
            logger.warning(f"{processor_name} processor timeout")
            return {"error": f"{processor_name} processing timeout"}
        except Exception as e:
            logger.error(f"{processor_name} processor error: {e}")
            return {"error": str(e)}
    
    async def _aggregate_and_yield_results(self, results: Dict[str, Any], original_audio_part: ProcessorPart) -> AsyncIterator[ProcessorPart]:
        """Aggregate results from all processors and yield comprehensive coaching data."""
        
        # Extract results
        analysis_result = results.get("analysis", {})
        feedback_result = results.get("feedback", {})
        metrics_result = results.get("metrics", {})
        
        # Create comprehensive coaching result
        coaching_data = {
            "session_id": str(self.session_id),
            "chunk_id": original_audio_part.metadata.get("chunk_id"),
            "chunk_number": self.processed_chunks,
            "timestamp": datetime.utcnow().isoformat(),
            
            # Voice analysis data
            "voice_analysis": analysis_result,
            
            # AI feedback data
            "coaching_feedback": feedback_result,
            
            # Performance metrics (when available)
            "performance_metrics": metrics_result,
            
            # Real-time coaching insights
            "real_time_insights": self._generate_realtime_insights(analysis_result, feedback_result),
            
            # Session progress
            "session_progress": self._calculate_session_progress(analysis_result, metrics_result),
            
            # Pipeline metadata
            "pipeline_info": {
                "processing_mode": "parallel" if self.pipeline_config["enable_parallel_processing"] else "sequential",
                "processors_run": [k for k, v in results.items() if v and not v.get("error")],
                "pipeline_stats": self.pipeline_stats.copy(),
                "chunk_priority": original_audio_part.metadata.get("processing_priority", "normal")
            }
        }
        
        # Yield main coaching result
        coaching_part = ProcessorPart(
            json.dumps(coaching_data) if isinstance(coaching_data, dict) else str(coaching_data),
            mimetype="application/json",
            metadata={
                "type": "coaching_result",
                "session_id": str(self.session_id),
                "chunk_id": original_audio_part.metadata.get("chunk_id"),
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        yield coaching_part
        
        # Yield real-time suggestions if available
        real_time_suggestions = self._extract_realtime_suggestions(results)
        if real_time_suggestions:
            suggestions_data = {
                "suggestions": real_time_suggestions,
                "session_id": str(self.session_id),
                "timestamp": datetime.utcnow().isoformat()
            }
            realtime_part = ProcessorPart(
                json.dumps(suggestions_data),
                mimetype="application/json",
                metadata={
                    "type": "realtime_feedback"
                }
            )
            yield realtime_part
        
        # Yield performance metrics if available
        metrics_result = results.get("metrics")
        if metrics_result and not metrics_result.get("error"):
            performance_data = {
                "performance_summary": metrics_result.get("performance_insights", {}),
                "session_stats": metrics_result.get("session_summary", {}),
                "session_id": str(self.session_id),
                "timestamp": datetime.utcnow().isoformat()
            }
            performance_part = ProcessorPart(
                json.dumps(performance_data),
                mimetype="application/json",
                metadata={
                    "type": "performance_update"
                }
            )
            yield performance_part
        
        # Yield milestone achievements if any
        milestones = self._check_for_milestones(
            results.get("analysis", {}), 
            results.get("feedback", {}), 
            results.get("metrics", {})
        )
        if milestones:
            milestone_data = {
                "milestones": milestones,
                "session_id": str(self.session_id),
                "timestamp": datetime.utcnow().isoformat()
            }
            milestone_part = ProcessorPart(
                json.dumps(milestone_data),
                mimetype="application/json",
                metadata={
                    "type": "milestone_achieved"
                }
            )
            yield milestone_part
    
    def _generate_realtime_insights(self, analysis_result: Dict[str, Any], feedback_result: Dict[str, Any]) -> Dict[str, Any]:
        """Generate immediate insights for real-time coaching with language adaptation."""
        insights = {
            "immediate_suggestions": [],
            "performance_alerts": [],
            "encouragement": "",
            "next_focus": "",
            "language": self.language.value
        }
        
        # Extract real-time insights from analysis with language adaptation
        if analysis_result and not analysis_result.get("error"):
            realtime_insights = analysis_result.get("realtime_insights", [])
            insights["immediate_suggestions"].extend(realtime_insights)
            
            # Language-specific performance alerts based on analysis
            self._add_language_specific_alerts(analysis_result, insights)
            
            # Performance alerts based on quality  
            quality_assessment = analysis_result.get("quality_assessment", {})
            overall_quality = quality_assessment.get("overall_quality", 0)
            
            if overall_quality < 0.5:
                insights["performance_alerts"].append({
                    "type": "quality_warning",
                    "message": get_ui_message("needs_improvement", self.language, "Focus on the basics"),
                    "priority": "high"
                })
            elif overall_quality > 0.8:
                insights["performance_alerts"].append({
                    "type": "quality_excellent", 
                    "message": get_ui_message("excellent_performance", self.language, "Excellent performance!"),
                    "priority": "positive"
                })
        
        # Extract encouragement from feedback
        if feedback_result and not feedback_result.get("error"):
            ai_feedback = feedback_result.get("ai_generated_feedback", {})
            default_encouragement = get_ui_message("keep_practicing", self.language, "Keep practicing!")
            default_focus = "Maintenir la consistance" if self.language == SupportedLanguage.FRENCH else "Maintain consistency"
            
            insights["encouragement"] = ai_feedback.get("encouragement", default_encouragement)
            insights["next_focus"] = ai_feedback.get("next_focus", default_focus)
        
        return insights
    
    def _add_language_specific_alerts(self, analysis_result: Dict[str, Any], insights: Dict[str, Any]):
        """Add language-specific performance alerts based on analysis."""
        
        # Check language-specific analysis results
        language_score = analysis_result.get("language_specific_score", {})
        if not language_score:
            return
            
        # Pace-specific alerts
        pace_analysis = analysis_result.get("pace_analysis", {})
        if pace_analysis:
            pace_feedback = pace_analysis.get("pace_feedback", "")
            if pace_feedback == "too_fast":
                message = get_ui_message("pace_too_fast", self.language, "Slow down slightly")
                insights["performance_alerts"].append({
                    "type": "pace_warning",
                    "message": message,
                    "priority": "medium"
                })
            elif pace_feedback == "too_slow":
                message = get_ui_message("pace_too_slow", self.language, "Speed up slightly")
                insights["performance_alerts"].append({
                    "type": "pace_warning", 
                    "message": message,
                    "priority": "medium"
                })
            elif pace_feedback == "optimal":
                message = get_ui_message("pace_good", self.language, "Perfect pace")
                insights["performance_alerts"].append({
                    "type": "pace_excellent",
                    "message": message,
                    "priority": "positive"
                })
        
        # Volume-specific alerts
        volume_analysis = analysis_result.get("volume_analysis", {})
        if volume_analysis:
            volume_level = volume_analysis.get("volume_level", "")
            if volume_level == "too_low":
                message = get_ui_message("volume_too_low", self.language, "Speak louder")
                insights["performance_alerts"].append({
                    "type": "volume_warning",
                    "message": message,
                    "priority": "high"
                })
            elif volume_level == "too_high":
                message = get_ui_message("volume_too_high", self.language, "Lower your volume")
                insights["performance_alerts"].append({
                    "type": "volume_warning",
                    "message": message,
                    "priority": "medium"
                })
            elif volume_level == "appropriate":
                message = get_ui_message("volume_good", self.language, "Good volume")
                insights["performance_alerts"].append({
                    "type": "volume_good", 
                    "message": message,
                    "priority": "positive"
                })
        
        # Clarity-specific alerts
        clarity_analysis = analysis_result.get("clarity_analysis", {})
        if clarity_analysis:
            clarity_level = clarity_analysis.get("clarity_level", "")
            if clarity_level == "needs_improvement":
                message = get_ui_message("clarity_needs_work", self.language, "Focus on clearer articulation")
                insights["performance_alerts"].append({
                    "type": "clarity_warning",
                    "message": message,
                    "priority": "medium"
                })
            elif clarity_level == "excellent":
                message = get_ui_message("clarity_excellent", self.language, "Excellent clarity")
                insights["performance_alerts"].append({
                    "type": "clarity_excellent",
                    "message": message,
                    "priority": "positive"
                })
        
        # Pitch variation alerts
        pitch_analysis = analysis_result.get("pitch_analysis", {})
        if pitch_analysis:
            if pitch_analysis.get("monotone_warning", False):
                if self.language == SupportedLanguage.FRENCH:
                    message = "Variez votre intonation pour maintenir l'attention"
                else:
                    message = "Add more vocal variety to maintain engagement" 
                insights["performance_alerts"].append({
                    "type": "intonation_warning",
                    "message": message,
                    "priority": "medium"
                })
    
    def _extract_realtime_suggestions(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract real-time suggestions from processing results."""
        suggestions = []
        
        # Extract from analysis
        analysis_result = results.get("analysis", {})
        if analysis_result and not analysis_result.get("error"):
            realtime_insights = analysis_result.get("realtime_insights", [])
            for insight in realtime_insights:
                suggestions.append({
                    "type": "analysis_suggestion",
                    "message": insight,
                    "priority": "normal",
                    "source": "voice_analysis"
                })
        
        # Extract from feedback
        feedback_result = results.get("feedback", {})
        if feedback_result and not feedback_result.get("error"):
            ai_feedback = feedback_result.get("ai_generated_feedback", {})
            immediate_tips = ai_feedback.get("immediate_tips", [])
            for tip in immediate_tips:
                suggestions.append({
                    "type": "coaching_tip",
                    "message": tip,
                    "priority": "high",
                    "source": "ai_feedback"
                })
        
        return suggestions
    
    def _calculate_session_progress(self, analysis_result: Dict[str, Any], metrics_result: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate session progress indicators."""
        progress = {
            "chunks_completed": self.processed_chunks,
            "session_duration_seconds": (datetime.utcnow() - self.start_time).total_seconds(),
            "processing_efficiency": self._calculate_processing_efficiency(),
            "quality_trend": "stable",
            "improvement_rate": 0.0
        }
        
        # Add quality trend from analysis
        if analysis_result and not analysis_result.get("error"):
            trend_analysis = analysis_result.get("trend_analysis", {})
            if "pace_trend" in trend_analysis:
                progress["quality_trend"] = trend_analysis["pace_trend"]
        
        # Add detailed progress from metrics
        if metrics_result and not metrics_result.get("error"):
            session_summary = metrics_result.get("session_summary", {})
            progress.update({
                "total_speaking_time": session_summary.get("session_duration_seconds", 0),
                "words_spoken": session_summary.get("total_words_spoken", 0),
                "feedback_items": session_summary.get("feedback_items_generated", 0)
            })
            
            # Improvement rate from metrics
            progression_metrics = metrics_result.get("metrics", {}).get("progression_metrics", {})
            progress["improvement_rate"] = progression_metrics.get("improvement_rate", 0.0)
        
        return progress
    
    def _calculate_processing_efficiency(self) -> float:
        """Calculate pipeline processing efficiency."""
        if self.processed_chunks == 0:
            return 1.0
        
        success_rate = 1.0 - (self.pipeline_stats["errors_count"] / max(self.processed_chunks, 1))
        avg_processing_time = self.pipeline_stats["total_pipeline_time_ms"] / max(self.processed_chunks, 1)
        
        # Efficiency based on success rate and processing speed
        # Target: <100ms per chunk
        time_efficiency = min(100.0 / max(avg_processing_time, 1), 1.0)
        
        return (success_rate + time_efficiency) / 2
    
    def _check_for_milestones(self, analysis_result: Dict[str, Any], feedback_result: Dict[str, Any], metrics_result: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Check for achievement milestones."""
        milestones = []
        
        # Check for quality milestones
        if analysis_result and not analysis_result.get("error"):
            quality_assessment = analysis_result.get("quality_assessment", {})
            overall_quality = quality_assessment.get("overall_quality", 0)
            
            # First excellent performance
            if overall_quality > 0.9 and not hasattr(self, '_excellent_milestone_achieved'):
                milestones.append({
                    "type": "quality_milestone",
                    "title": "Performance Excellente !",
                    "description": "Vous avez atteint un niveau de qualité exceptionnel",
                    "achievement_level": "excellent",
                    "score": overall_quality
                })
                self._excellent_milestone_achieved = True
            
            # Consistency milestone
            consistency_quality = quality_assessment.get("consistency_quality", 0)
            if consistency_quality > 0.85 and not hasattr(self, '_consistency_milestone_achieved'):
                milestones.append({
                    "type": "consistency_milestone",
                    "title": "Consistance Remarquable !",
                    "description": "Vous maintenez une performance très régulière",
                    "achievement_level": "consistent",
                    "score": consistency_quality
                })
                self._consistency_milestone_achieved = True
        
        # Check for improvement milestones from metrics
        if metrics_result and not metrics_result.get("error"):
            milestones_data = metrics_result.get("analytics", {}).get("milestone_tracking", [])
            # Add new milestones that haven't been reported yet
            for milestone in milestones_data:
                if milestone.get("chunk_number") == self.processed_chunks:
                    milestones.append({
                        "type": "improvement_milestone",
                        "title": "Progression Significative !",
                        "description": milestone.get("description", "Amélioration détectée"),
                        "achievement_level": "improvement",
                        "improvement_percentage": milestone.get("improvement_percentage", 0)
                    })
        
        # Chunk count milestones
        if self.processed_chunks in [10, 25, 50, 100]:
            milestones.append({
                "type": "endurance_milestone",
                "title": f"{self.processed_chunks} Chunks Traités !",
                "description": f"Vous avez maintenu votre effort sur {self.processed_chunks} analyses",
                "achievement_level": "endurance",
                "chunks_count": self.processed_chunks
            })
        
        return milestones
    
    def _update_pipeline_stats(self, processing_time_ms: float, success: bool):
        """Update pipeline performance statistics."""
        self.pipeline_stats["chunks_processed"] += 1
        self.pipeline_stats["total_pipeline_time_ms"] += processing_time_ms
        
        if not success:
            self.pipeline_stats["errors_count"] += 1
        
        # Update success rate
        self.pipeline_stats["success_rate"] = 1.0 - (
            self.pipeline_stats["errors_count"] / self.pipeline_stats["chunks_processed"]
        )
        
        # Update average processing time
        self.pipeline_stats["average_processing_time_ms"] = (
            self.pipeline_stats["total_pipeline_time_ms"] / self.pipeline_stats["chunks_processed"]
        )
    
    async def _create_error_result(self, original_part: ProcessorPart, error: Exception) -> ProcessorPart:
        """Create error result with fallback data."""
        error_data = {
            "error": str(error),
            "error_type": type(error).__name__,
            "session_id": str(self.session_id),
            "chunk_number": self.processed_chunks,
            "timestamp": datetime.utcnow().isoformat(),
            "fallback_feedback": {
                "message": "Traitement temporairement indisponible",
                "suggestion": "Continuez votre présentation, l'analyse reprendra automatiquement",
                "type": "system_message"
            },
            "pipeline_info": {
                "error_recovery": True,
                "retry_available": True,
                "processing_mode": "error_fallback"
            }
        }
        
        return ProcessorPart(
            json.dumps(error_data) if isinstance(error_data, dict) else str(error_data),
            mimetype="application/json",
            metadata={
                **original_part.metadata,
                "type": "error_result",
                "error_timestamp": datetime.utcnow().isoformat(),
                "pipeline_processor": self.__class__.__name__,
                "error_recovery_available": True
            }
        )
    
    async def get_session_summary(self) -> Dict[str, Any]:
        """Generate comprehensive session summary."""
        session_duration = (datetime.utcnow() - self.start_time).total_seconds()
        
        return {
            "session_id": str(self.session_id),
            "session_duration_seconds": session_duration,
            "chunks_processed": self.processed_chunks,
            "pipeline_stats": self.pipeline_stats.copy(),
            "processing_efficiency": self._calculate_processing_efficiency(),
            "average_chunk_time_ms": (
                self.pipeline_stats["total_pipeline_time_ms"] / max(self.processed_chunks, 1)
            ),
            "total_processing_time_ms": self.pipeline_stats["total_pipeline_time_ms"],
            "error_rate": (
                self.pipeline_stats["errors_count"] / max(self.processed_chunks, 1)
            ),
            "pipeline_configuration": self.pipeline_config.copy(),
            "processors_used": ["AnalysisProcessor", "FeedbackProcessor", "MetricsProcessor"],
            "session_end_timestamp": datetime.utcnow().isoformat()
        }


class FeedbackAggregator:
    """Aggregates and manages feedback across the session."""
    
    def __init__(self):
        self.feedback_history: List[Dict[str, Any]] = []
        self.feedback_themes: Dict[str, int] = {}
    
    def add_feedback(self, feedback_data: Dict[str, Any]):
        """Add feedback to aggregation."""
        self.feedback_history.append({
            "timestamp": datetime.utcnow(),
            "data": feedback_data
        })
        
        # Track themes
        feedback_items = feedback_data.get("feedback_items", [])
        for item in feedback_items:
            theme = item.get("type", "general")
            self.feedback_themes[theme] = self.feedback_themes.get(theme, 0) + 1
    
    def get_summary(self) -> Dict[str, Any]:
        """Get feedback summary."""
        return {
            "total_feedback_items": len(self.feedback_history),
            "main_themes": dict(sorted(self.feedback_themes.items(), key=lambda x: x[1], reverse=True)[:5]),
            "recent_feedback": self.feedback_history[-5:] if self.feedback_history else []
        }


class MetricsAggregator:
    """Aggregates and manages metrics across the session."""
    
    def __init__(self):
        self.metrics_history: List[Dict[str, Any]] = []
        self.performance_trend: List[float] = []
    
    def add_metrics(self, metrics_data: Dict[str, Any]):
        """Add metrics to aggregation."""
        self.metrics_history.append({
            "timestamp": datetime.utcnow(),
            "data": metrics_data
        })
        
        # Track performance trend
        if "performance_insights" in metrics_data:
            current_status = metrics_data["performance_insights"].get("current_status", {})
            quality_score = current_status.get("quality_score", 0.0)
            self.performance_trend.append(quality_score)
            
            # Keep trend manageable
            if len(self.performance_trend) > 50:
                self.performance_trend = self.performance_trend[-40:]
    
    def get_summary(self) -> Dict[str, Any]:
        """Get metrics summary."""
        return {
            "total_metrics_calculated": len(self.metrics_history),
            "performance_trend": self.performance_trend[-10:] if self.performance_trend else [],
            "trend_direction": self._calculate_trend_direction(),
            "latest_metrics": self.metrics_history[-1]["data"] if self.metrics_history else {}
        }
    
    def _calculate_trend_direction(self) -> str:
        """Calculate overall trend direction."""
        if len(self.performance_trend) < 3:
            return "insufficient_data"
        
        recent = self.performance_trend[-3:]
        earlier = self.performance_trend[-6:-3] if len(self.performance_trend) >= 6 else self.performance_trend[:-3]
        
        if not earlier:
            return "insufficient_data"
        
        recent_avg = sum(recent) / len(recent)
        earlier_avg = sum(earlier) / len(earlier)
        
        if recent_avg > earlier_avg + 0.05:
            return "improving"
        elif recent_avg < earlier_avg - 0.05:
            return "declining"
        else:
            return "stable" 