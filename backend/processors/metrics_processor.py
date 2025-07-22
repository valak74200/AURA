"""
AURA Performance Metrics Processor

GenAI Processor for calculating, tracking, and analyzing comprehensive
performance metrics throughout presentation coaching sessions.
"""

import asyncio
from datetime import datetime, timedelta
from typing import AsyncIterator, Dict, Any, List, Optional, Tuple
from collections import deque
import numpy as np
import statistics

from genai_processors import Processor, ProcessorPart

from models.session import SessionConfig
from models.analytics import PerformanceMetric, MetricType
from models.feedback import VoiceMetrics
from utils.logging import get_logger
from utils.exceptions import ProcessorException
from app.config import get_settings

logger = get_logger(__name__)
settings = get_settings()


class MetricsProcessor(Processor):
    """
    Processor that calculates and tracks comprehensive performance metrics
    from voice analysis and feedback data with advanced analytics.
    """
    
    def __init__(self, config: SessionConfig):
        """
        Initialize metrics processor.
        
        Args:
            config: Session configuration
        """
        super().__init__()
        self.config = config
        
        # Metrics tracking with sliding windows
        self.metrics_buffer = {
            MetricType.VOICE_PACE: deque(maxlen=100),
            MetricType.VOICE_VOLUME: deque(maxlen=100),
            MetricType.VOICE_CLARITY: deque(maxlen=100),
            MetricType.PAUSE_FREQUENCY: deque(maxlen=100),
            MetricType.FILLER_WORDS: deque(maxlen=100),
            MetricType.ENGAGEMENT_SCORE: deque(maxlen=100)
        }
        
        # Session-wide aggregated metrics
        self.session_metrics = {
            "total_chunks_processed": 0,
            "total_feedback_items": 0,
            "session_start_time": datetime.utcnow(),
            "total_speaking_duration": 0.0,
            "total_words_spoken": 0,
            "peak_performance_moments": [],
            "improvement_milestones": [],
            "consistency_scores": [],
            "energy_levels": []
        }
        
        # Performance tracking and analytics
        self.performance_history = []
        self.improvement_indicators = {
            "pace_stability": [],
            "volume_consistency_trend": [],
            "clarity_progression": [],
            "confidence_evolution": [],
            "overall_quality_trend": []
        }
        
        # Benchmark and comparison data
        self.benchmarks = {
            "pace_wpm": {"excellent": (140, 160), "good": (120, 180), "acceptable": (100, 200)},
            "volume_consistency": {"excellent": 0.9, "good": 0.8, "acceptable": 0.7},
            "clarity_score": {"excellent": 0.9, "good": 0.8, "acceptable": 0.7},
            "voice_activity": {"excellent": (0.7, 0.8), "good": (0.6, 0.9), "acceptable": (0.5, 0.95)}
        }
        
        # Analytics parameters
        self.analytics_params = {
            "trend_analysis_window": 10,
            "performance_smoothing_factor": 0.3,
            "milestone_threshold": 0.1,  # 10% improvement
            "consistency_window": 5,
            "outlier_detection_threshold": 2.0  # Standard deviations
        }
        
        logger.info("Initialized MetricsProcessor")
    
    async def call(self, input_stream: AsyncIterator[ProcessorPart]) -> AsyncIterator[ProcessorPart]:
        """Call method required by Processor base class."""
        async for result in self.process(input_stream):
            yield result
    
    async def process(self, input_stream: AsyncIterator[ProcessorPart]) -> AsyncIterator[ProcessorPart]:
        """
        Process feedback data and calculate comprehensive performance metrics.
        
        Args:
            input_stream: Stream of feedback and analysis results
            
        Yields:
            ProcessorPart: Calculated metrics and performance analytics
        """
        try:
            async for input_part in input_stream:
                start_time = datetime.utcnow()
                
                # Process different types of input data
                if input_part.metadata.get("type", "unknown") == "feedback_generated":
                    metrics_results = await self._process_feedback_metrics(input_part)
                elif input_part.metadata.get("type", "unknown") == "voice_analysis":
                    metrics_results = await self._process_voice_metrics(input_part)
                else:
                    # Pass through other types
                    continue
                
                if metrics_results:
                    # Update session metrics
                    self._update_session_metrics(input_part.text, metrics_results)
                    
                    # Calculate advanced analytics
                    analytics_results = await self._calculate_advanced_analytics()
                    
                    # Generate performance insights
                    performance_insights = await self._generate_performance_insights()
                    
                    # Create comprehensive metrics part
                    metrics_part = ProcessorPart(
                        data={
                            "metrics": metrics_results,
                            "analytics": analytics_results,
                            "performance_insights": performance_insights,
                            "session_summary": self._generate_session_summary(),
                            "benchmarks": self._calculate_benchmark_comparisons(metrics_results),
                            "metadata": {
                                "processor": self.__class__.__name__,
                                "calculation_timestamp": datetime.utcnow().isoformat(),
                                "processing_time_ms": (datetime.utcnow() - start_time).total_seconds() * 1000,
                                "chunk_number": input_part.metadata.get("chunk_number", 0)
                            }
                        },
                        type="performance_metrics",
                        metadata={
                            **input_part.metadata,
                            "processor": self.__class__.__name__,
                            "metrics_timestamp": datetime.utcnow().isoformat()
                        }
                    )
                    
                    logger.debug(
                        "Performance metrics calculated",
                        extra={
                            "chunk_number": input_part.metadata.get("chunk_number", 0),
                            "metrics_count": len(metrics_results) if isinstance(metrics_results, dict) else 0,
                            "session_id": input_part.metadata.get("session_id")
                        }
                    )
                    
                    yield metrics_part
                    
        except Exception as e:
            logger.error(
                "Metrics processor error",
                extra={"error": str(e)},
                exc_info=True
            )
            raise ProcessorException("MetricsProcessor", str(e))
    
    async def _process_feedback_metrics(self, feedback_part: ProcessorPart) -> Dict[str, Any]:
        """Process feedback data to extract performance metrics."""
        feedback_data = feedback_part.text
        
        metrics = {
            "feedback_metrics": {
                "total_feedback_items": len(feedback_data.get("feedback_items", [])),
                "positive_feedback_ratio": self._calculate_positive_feedback_ratio(feedback_data),
                "improvement_areas_count": len(feedback_data.get("ai_generated_feedback", {}).get("improvements", [])),
                "strengths_identified": len(feedback_data.get("ai_generated_feedback", {}).get("strengths", [])),
                "coaching_engagement": self._calculate_coaching_engagement(feedback_data)
            },
            "real_time_metrics": {
                "suggestion_count": len(feedback_data.get("real_time_suggestions", [])),
                "high_priority_issues": len([s for s in feedback_data.get("real_time_suggestions", []) if s.get("priority") == "high"]),
                "success_moments": len([s for s in feedback_data.get("real_time_suggestions", []) if s.get("severity") == "success"])
            }
        }
        
        # Update feedback tracking
        self.session_metrics["total_feedback_items"] += metrics["feedback_metrics"]["total_feedback_items"]
        
        return metrics
    
    async def _process_voice_metrics(self, analysis_part: ProcessorPart) -> Dict[str, Any]:
        """Process voice analysis data to calculate performance metrics."""
        analysis_data = analysis_part.text
        chunk_metrics = analysis_data.get("chunk_metrics", {})
        advanced_metrics = analysis_data.get("advanced_metrics", {})
        quality_assessment = analysis_data.get("quality_assessment", {})
        
        # Extract and store key metrics in buffers
        self._update_metrics_buffers(chunk_metrics, advanced_metrics)
        
        # Calculate comprehensive voice metrics
        voice_metrics = {
            "current_performance": {
                "pace_wpm": chunk_metrics.get("pace_wpm", 0),
                "volume_consistency": chunk_metrics.get("volume_consistency", 0),
                "clarity_score": chunk_metrics.get("clarity_score", 0),
                "voice_activity_ratio": chunk_metrics.get("voice_activity_ratio", 0),
                "confidence_score": advanced_metrics.get("confidence_score", 0),
                "overall_quality": quality_assessment.get("overall_quality", 0)
            },
            "stability_metrics": {
                "pace_stability": self._calculate_stability(MetricType.VOICE_PACE),
                "volume_stability": self._calculate_stability(MetricType.VOICE_VOLUME),
                "clarity_consistency": self._calculate_stability(MetricType.VOICE_CLARITY),
                "performance_variability": self._calculate_overall_variability()
            },
            "progression_metrics": {
                "improvement_rate": self._calculate_improvement_rate(),
                "learning_curve": self._calculate_learning_curve(),
                "consistency_trend": self._calculate_consistency_trend(),
                "peak_performance_ratio": self._calculate_peak_performance_ratio()
            }
        }
        
        # Update session tracking
        self.session_metrics["total_chunks_processed"] += 1
        self.session_metrics["total_speaking_duration"] += chunk_metrics.get("duration", 0)
        self.session_metrics["total_words_spoken"] += chunk_metrics.get("estimated_words", 0)
        
        return voice_metrics
    
    def _update_metrics_buffers(self, chunk_metrics: Dict[str, Any], advanced_metrics: Dict[str, Any]):
        """Update sliding window buffers with new metrics."""
        # Voice pace
        pace_wpm = chunk_metrics.get("pace_wpm", 0)
        if pace_wpm > 0:  # Only add valid pace measurements
            self.metrics_buffer[MetricType.VOICE_PACE].append(pace_wpm)
        
        # Volume metrics
        volume_consistency = chunk_metrics.get("volume_consistency", 0)
        self.metrics_buffer[MetricType.VOICE_VOLUME].append(volume_consistency)
        
        # Clarity
        clarity_score = chunk_metrics.get("clarity_score", 0)
        self.metrics_buffer[MetricType.VOICE_CLARITY].append(clarity_score)
        
        # Engagement (derived from confidence and voice activity)
        confidence = advanced_metrics.get("confidence_score", 0)
        voice_activity = chunk_metrics.get("voice_activity_ratio", 0)
        engagement_score = (confidence + voice_activity) / 2
        self.metrics_buffer[MetricType.ENGAGEMENT_SCORE].append(engagement_score)
        
        # Store in performance history for trend analysis
        self.performance_history.append({
            "timestamp": datetime.utcnow(),
            "pace": pace_wpm,
            "volume_consistency": volume_consistency,
            "clarity": clarity_score,
            "confidence": confidence,
            "engagement": engagement_score
        })
        
        # Keep history manageable
        if len(self.performance_history) > 200:
            self.performance_history = self.performance_history[-150:]
    
    def _calculate_stability(self, metric_type: MetricType) -> float:
        """Calculate stability score for a specific metric (0-1, higher = more stable)."""
        buffer = self.metrics_buffer[metric_type]
        
        if len(buffer) < 3:
            return 0.5  # Insufficient data
        
        values = list(buffer)
        
        # Remove outliers for stability calculation
        values_clean = self._remove_outliers(values)
        
        if len(values_clean) < 2:
            return 0.5
        
        # Calculate coefficient of variation (lower = more stable)
        mean_val = statistics.mean(values_clean)
        if mean_val == 0:
            return 1.0 if all(v == 0 for v in values_clean) else 0.0
        
        std_val = statistics.stdev(values_clean) if len(values_clean) > 1 else 0
        cv = std_val / mean_val
        
        # Convert to stability score (inverse relationship)
        stability = 1.0 / (1.0 + cv)
        return min(max(stability, 0.0), 1.0)
    
    def _calculate_overall_variability(self) -> float:
        """Calculate overall performance variability across all metrics."""
        variabilities = []
        
        for metric_type in [MetricType.VOICE_PACE, MetricType.VOICE_VOLUME, MetricType.VOICE_CLARITY]:
            stability = self._calculate_stability(metric_type)
            variability = 1.0 - stability
            variabilities.append(variability)
        
        return statistics.mean(variabilities) if variabilities else 0.5
    
    def _calculate_improvement_rate(self) -> float:
        """Calculate rate of improvement over recent performance."""
        if len(self.performance_history) < 6:
            return 0.0
        
        # Compare recent performance (last 3) with earlier performance (3 before that)
        recent_performance = self.performance_history[-3:]
        earlier_performance = self.performance_history[-6:-3]
        
        # Calculate average quality scores
        recent_avg = statistics.mean([
            (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
            for p in recent_performance
        ])
        
        earlier_avg = statistics.mean([
            (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
            for p in earlier_performance
        ])
        
        # Calculate improvement rate
        improvement = (recent_avg - earlier_avg) / max(earlier_avg, 0.1)
        return max(min(improvement, 1.0), -1.0)  # Clamp between -1 and 1
    
    def _calculate_learning_curve(self) -> Dict[str, float]:
        """Calculate learning curve metrics."""
        if len(self.performance_history) < 10:
            return {"slope": 0.0, "acceleration": 0.0, "plateau_indicator": 0.0}
        
        # Extract quality scores over time
        quality_scores = []
        for i, perf in enumerate(self.performance_history):
            quality = (perf["clarity"] + perf["confidence"] + min(perf["pace"]/150, 1.0)) / 3
            quality_scores.append((i, quality))
        
        # Calculate trend slope (simple linear regression)
        n = len(quality_scores)
        sum_x = sum(i for i, _ in quality_scores)
        sum_y = sum(q for _, q in quality_scores)
        sum_xy = sum(i * q for i, q in quality_scores)
        sum_x2 = sum(i * i for i, _ in quality_scores)
        
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x) if (n * sum_x2 - sum_x * sum_x) != 0 else 0
        
        # Calculate acceleration (change in slope over time)
        if len(quality_scores) >= 20:
            mid_point = len(quality_scores) // 2
            early_slope = self._calculate_slope(quality_scores[:mid_point])
            late_slope = self._calculate_slope(quality_scores[mid_point:])
            acceleration = late_slope - early_slope
        else:
            acceleration = 0.0
        
        # Plateau detection (low variance in recent performance)
        recent_scores = [q for _, q in quality_scores[-10:]]
        plateau_indicator = 1.0 - (statistics.stdev(recent_scores) if len(recent_scores) > 1 else 1.0)
        
        return {
            "slope": slope,
            "acceleration": acceleration,
            "plateau_indicator": plateau_indicator
        }
    
    def _calculate_slope(self, data_points: List[Tuple[int, float]]) -> float:
        """Calculate slope for a set of data points."""
        if len(data_points) < 2:
            return 0.0
        
        n = len(data_points)
        sum_x = sum(i for i, _ in data_points)
        sum_y = sum(q for _, q in data_points)
        sum_xy = sum(i * q for i, q in data_points)
        sum_x2 = sum(i * i for i, _ in data_points)
        
        denominator = n * sum_x2 - sum_x * sum_x
        return (n * sum_xy - sum_x * sum_y) / denominator if denominator != 0 else 0.0
    
    def _calculate_consistency_trend(self) -> Dict[str, float]:
        """Calculate consistency trends across different metrics."""
        trends = {}
        
        for metric_name, metric_type in [
            ("pace", MetricType.VOICE_PACE),
            ("volume", MetricType.VOICE_VOLUME),
            ("clarity", MetricType.VOICE_CLARITY)
        ]:
            buffer = self.metrics_buffer[metric_type]
            if len(buffer) >= self.analytics_params["trend_analysis_window"]:
                # Calculate consistency over time windows
                window_size = 5
                consistency_scores = []
                
                for i in range(window_size, len(buffer)):
                    window = list(buffer)[i-window_size:i]
                    if window:
                        cv = statistics.stdev(window) / statistics.mean(window) if statistics.mean(window) > 0 else 0
                        consistency = 1.0 / (1.0 + cv)
                        consistency_scores.append(consistency)
                
                if len(consistency_scores) >= 2:
                    # Calculate trend in consistency
                    recent_consistency = statistics.mean(consistency_scores[-3:])
                    earlier_consistency = statistics.mean(consistency_scores[:3])
                    trend = (recent_consistency - earlier_consistency) / max(earlier_consistency, 0.1)
                    trends[f"{metric_name}_consistency_trend"] = max(min(trend, 1.0), -1.0)
                else:
                    trends[f"{metric_name}_consistency_trend"] = 0.0
            else:
                trends[f"{metric_name}_consistency_trend"] = 0.0
        
        return trends
    
    def _calculate_peak_performance_ratio(self) -> float:
        """Calculate ratio of peak performance moments."""
        if len(self.performance_history) < 5:
            return 0.0
        
        # Define peak performance as top 20% of quality scores
        quality_scores = [
            (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
            for p in self.performance_history
        ]
        
        threshold = np.percentile(quality_scores, 80)  # Top 20%
        peak_moments = sum(1 for score in quality_scores if score >= threshold)
        
        return peak_moments / len(quality_scores)
    
    def _remove_outliers(self, values: List[float]) -> List[float]:
        """Remove statistical outliers from a list of values."""
        if len(values) < 3:
            return values
        
        mean_val = statistics.mean(values)
        std_val = statistics.stdev(values) if len(values) > 1 else 0
        
        if std_val == 0:
            return values
        
        threshold = self.analytics_params["outlier_detection_threshold"]
        return [v for v in values if abs(v - mean_val) <= threshold * std_val]
    
    async def _calculate_advanced_analytics(self) -> Dict[str, Any]:
        """Calculate advanced analytics and insights."""
        return {
            "trend_analysis": self._calculate_comprehensive_trends(),
            "performance_patterns": self._analyze_performance_patterns(),
            "milestone_tracking": self._track_improvement_milestones(),
            "comparative_analysis": self._calculate_comparative_metrics(),
            "predictive_insights": self._generate_predictive_insights()
        }
    
    def _calculate_comprehensive_trends(self) -> Dict[str, Any]:
        """Calculate comprehensive trend analysis."""
        trends = {}
        
        if len(self.performance_history) >= 10:
            # Overall performance trend
            quality_trend = self._calculate_metric_trend("overall_quality")
            trends["overall_performance"] = quality_trend
            
            # Individual metric trends
            for metric in ["pace", "clarity", "confidence"]:
                trends[f"{metric}_trend"] = self._calculate_metric_trend(metric)
            
            # Volatility analysis
            trends["performance_volatility"] = self._calculate_performance_volatility()
            
            # Momentum indicators
            trends["improvement_momentum"] = self._calculate_improvement_momentum()
        
        return trends
    
    def _calculate_metric_trend(self, metric_name: str) -> Dict[str, float]:
        """Calculate trend for a specific metric."""
        if len(self.performance_history) < 5:
            return {"direction": 0.0, "strength": 0.0, "confidence": 0.0}
        
        # Extract metric values
        if metric_name == "overall_quality":
            values = [
                (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
                for p in self.performance_history
            ]
        else:
            values = [p.get(metric_name, 0) for p in self.performance_history]
        
        # Calculate trend direction and strength
        n = len(values)
        x_values = list(range(n))
        
        # Simple linear regression
        slope = self._calculate_slope(list(zip(x_values, values)))
        
        # Trend strength (R-squared)
        mean_y = statistics.mean(values)
        ss_tot = sum((y - mean_y) ** 2 for y in values)
        ss_res = sum((values[i] - (slope * i + mean_y)) ** 2 for i in range(n))
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        
        return {
            "direction": slope,
            "strength": abs(slope),
            "confidence": r_squared
        }
    
    def _calculate_performance_volatility(self) -> float:
        """Calculate performance volatility (stability over time)."""
        if len(self.performance_history) < 5:
            return 0.5
        
        quality_scores = [
            (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
            for p in self.performance_history
        ]
        
        # Calculate rolling standard deviation
        window_size = 5
        volatilities = []
        
        for i in range(window_size, len(quality_scores)):
            window = quality_scores[i-window_size:i]
            volatility = statistics.stdev(window) if len(window) > 1 else 0
            volatilities.append(volatility)
        
        return statistics.mean(volatilities) if volatilities else 0.0
    
    def _calculate_improvement_momentum(self) -> float:
        """Calculate improvement momentum (acceleration of improvement)."""
        if len(self.performance_history) < 10:
            return 0.0
        
        # Split into three periods
        third = len(self.performance_history) // 3
        early = self.performance_history[:third]
        middle = self.performance_history[third:2*third]
        recent = self.performance_history[2*third:]
        
        # Calculate average quality for each period
        def avg_quality(period):
            return statistics.mean([
                (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
                for p in period
            ]) if period else 0
        
        early_avg = avg_quality(early)
        middle_avg = avg_quality(middle)
        recent_avg = avg_quality(recent)
        
        # Calculate momentum (acceleration)
        if early_avg > 0:
            early_to_middle = (middle_avg - early_avg) / early_avg
            middle_to_recent = (recent_avg - middle_avg) / middle_avg if middle_avg > 0 else 0
            momentum = middle_to_recent - early_to_middle
            return max(min(momentum, 1.0), -1.0)
        
        return 0.0
    
    def _analyze_performance_patterns(self) -> Dict[str, Any]:
        """Analyze performance patterns and behaviors."""
        patterns = {
            "consistency_patterns": self._identify_consistency_patterns(),
            "peak_performance_triggers": self._identify_peak_triggers(),
            "improvement_cycles": self._identify_improvement_cycles(),
            "performance_rhythm": self._analyze_performance_rhythm()
        }
        
        return patterns
    
    def _identify_consistency_patterns(self) -> Dict[str, Any]:
        """Identify patterns in performance consistency."""
        if len(self.performance_history) < 20:
            return {"pattern_detected": False, "description": "Insufficient data"}
        
        # Analyze consistency over different time windows
        consistencies = []
        window_size = 5
        
        for i in range(window_size, len(self.performance_history)):
            window = self.performance_history[i-window_size:i]
            quality_scores = [
                (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
                for p in window
            ]
            consistency = 1.0 - (statistics.stdev(quality_scores) if len(quality_scores) > 1 else 0)
            consistencies.append(consistency)
        
        # Identify patterns
        avg_consistency = statistics.mean(consistencies)
        consistency_trend = self._calculate_slope(list(enumerate(consistencies)))
        
        pattern_type = "improving" if consistency_trend > 0.01 else "declining" if consistency_trend < -0.01 else "stable"
        
        return {
            "pattern_detected": True,
            "pattern_type": pattern_type,
            "average_consistency": avg_consistency,
            "trend_strength": abs(consistency_trend),
            "description": f"Consistency is {pattern_type} with average score of {avg_consistency:.2f}"
        }
    
    def _identify_peak_triggers(self) -> List[Dict[str, Any]]:
        """Identify what triggers peak performance."""
        if len(self.performance_history) < 10:
            return []
        
        # Calculate quality scores
        quality_scores = [
            (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
            for p in self.performance_history
        ]
        
        # Identify peaks (top 20%)
        threshold = np.percentile(quality_scores, 80)
        peaks = [i for i, score in enumerate(quality_scores) if score >= threshold]
        
        # Analyze common characteristics of peak moments
        peak_characteristics = {
            "avg_pace": statistics.mean([self.performance_history[i]["pace"] for i in peaks]),
            "avg_confidence": statistics.mean([self.performance_history[i]["confidence"] for i in peaks]),
            "avg_clarity": statistics.mean([self.performance_history[i]["clarity"] for i in peaks])
        }
        
        return [{
            "trigger_type": "high_confidence",
            "description": "Peak performance often occurs with high confidence",
            "characteristics": peak_characteristics,
            "frequency": len(peaks) / len(quality_scores)
        }]
    
    def _identify_improvement_cycles(self) -> Dict[str, Any]:
        """Identify cycles in improvement patterns."""
        if len(self.performance_history) < 15:
            return {"cycles_detected": False}
        
        quality_scores = [
            (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
            for p in self.performance_history
        ]
        
        # Simple cycle detection using moving averages
        short_ma = []
        long_ma = []
        
        for i in range(3, len(quality_scores)):
            short_avg = statistics.mean(quality_scores[i-3:i])
            short_ma.append(short_avg)
            
            if i >= 7:
                long_avg = statistics.mean(quality_scores[i-7:i])
                long_ma.append(long_avg)
        
        # Detect crossovers (potential cycle points)
        crossovers = 0
        if len(short_ma) == len(long_ma):
            for i in range(1, len(short_ma)):
                if (short_ma[i] > long_ma[i]) != (short_ma[i-1] > long_ma[i-1]):
                    crossovers += 1
        
        cycle_frequency = crossovers / len(short_ma) if short_ma else 0
        
        return {
            "cycles_detected": crossovers > 2,
            "cycle_frequency": cycle_frequency,
            "description": f"Detected {crossovers} improvement cycles"
        }
    
    def _analyze_performance_rhythm(self) -> Dict[str, Any]:
        """Analyze the rhythm and pace of performance changes."""
        if len(self.performance_history) < 10:
            return {"rhythm_detected": False}
        
        # Calculate performance deltas
        quality_scores = [
            (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
            for p in self.performance_history
        ]
        
        deltas = [quality_scores[i] - quality_scores[i-1] for i in range(1, len(quality_scores))]
        
        # Analyze rhythm characteristics
        avg_change = statistics.mean(deltas)
        change_volatility = statistics.stdev(deltas) if len(deltas) > 1 else 0
        
        # Classify rhythm type
        if change_volatility < 0.05:
            rhythm_type = "steady"
        elif avg_change > 0.01:
            rhythm_type = "progressive"
        elif avg_change < -0.01:
            rhythm_type = "regressive"
        else:
            rhythm_type = "variable"
        
        return {
            "rhythm_detected": True,
            "rhythm_type": rhythm_type,
            "average_change": avg_change,
            "volatility": change_volatility,
            "description": f"Performance shows a {rhythm_type} rhythm"
        }
    
    def _track_improvement_milestones(self) -> List[Dict[str, Any]]:
        """Track and identify improvement milestones."""
        milestones = []
        
        if len(self.performance_history) < 5:
            return milestones
        
        # Calculate baseline (first few measurements)
        baseline_quality = statistics.mean([
            (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
            for p in self.performance_history[:3]
        ])
        
        # Check for significant improvements
        for i in range(3, len(self.performance_history)):
            current_quality = (
                self.performance_history[i]["clarity"] +
                self.performance_history[i]["confidence"] +
                min(self.performance_history[i]["pace"]/150, 1.0)
            ) / 3
            
            improvement = (current_quality - baseline_quality) / baseline_quality
            
            if improvement >= self.analytics_params["milestone_threshold"]:
                milestones.append({
                    "timestamp": self.performance_history[i]["timestamp"].isoformat(),
                    "chunk_number": i,
                    "improvement_percentage": improvement * 100,
                    "quality_score": current_quality,
                    "milestone_type": "significant_improvement",
                    "description": f"Amélioration de {improvement*100:.1f}% par rapport au début"
                })
                
                # Update baseline for next milestone detection
                baseline_quality = current_quality
        
        return milestones
    
    def _calculate_comparative_metrics(self) -> Dict[str, Any]:
        """Calculate metrics compared to benchmarks and standards."""
        if not self.performance_history:
            return {}
        
        # Get latest performance
        latest = self.performance_history[-1]
        
        comparisons = {}
        
        # Compare against benchmarks
        for metric, benchmarks in self.benchmarks.items():
            if metric in ["pace_wpm"]:
                value = latest["pace"]
                level = self._determine_performance_level(value, benchmarks)
                comparisons[metric] = {
                    "current_value": value,
                    "performance_level": level,
                    "benchmark_range": benchmarks,
                    "percentile": self._calculate_percentile(value, metric)
                }
        
        # Session comparisons
        if len(self.performance_history) >= 10:
            session_start = self.performance_history[:5]
            session_recent = self.performance_history[-5:]
            
            start_avg = statistics.mean([
                (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
                for p in session_start
            ])
            
            recent_avg = statistics.mean([
                (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
                for p in session_recent
            ])
            
            comparisons["session_improvement"] = {
                "start_average": start_avg,
                "recent_average": recent_avg,
                "improvement_ratio": (recent_avg - start_avg) / start_avg if start_avg > 0 else 0,
                "improvement_description": self._describe_improvement(recent_avg - start_avg)
            }
        
        return comparisons
    
    def _determine_performance_level(self, value: float, benchmarks: Dict) -> str:
        """Determine performance level based on benchmarks."""
        if isinstance(benchmarks["excellent"], tuple):
            if benchmarks["excellent"][0] <= value <= benchmarks["excellent"][1]:
                return "excellent"
            elif benchmarks["good"][0] <= value <= benchmarks["good"][1]:
                return "good"
            elif benchmarks["acceptable"][0] <= value <= benchmarks["acceptable"][1]:
                return "acceptable"
            else:
                return "needs_improvement"
        else:
            if value >= benchmarks["excellent"]:
                return "excellent"
            elif value >= benchmarks["good"]:
                return "good"
            elif value >= benchmarks["acceptable"]:
                return "acceptable"
            else:
                return "needs_improvement"
    
    def _calculate_percentile(self, value: float, metric: str) -> float:
        """Calculate percentile ranking for a metric value."""
        # This would typically use historical data from many users
        # For now, using simplified calculation based on benchmarks
        if metric == "pace_wpm":
            if value < 100:
                return 20.0
            elif value < 120:
                return 40.0
            elif value < 160:
                return 70.0
            elif value < 180:
                return 85.0
            else:
                return 95.0
        
        return 50.0  # Default median
    
    def _describe_improvement(self, improvement: float) -> str:
        """Describe improvement in human terms."""
        if improvement > 0.1:
            return "Amélioration significative"
        elif improvement > 0.05:
            return "Amélioration notable"
        elif improvement > 0.01:
            return "Légère amélioration"
        elif improvement > -0.01:
            return "Performance stable"
        elif improvement > -0.05:
            return "Légère baisse"
        else:
            return "Baisse notable"
    
    def _generate_predictive_insights(self) -> Dict[str, Any]:
        """Generate predictive insights based on current trends."""
        if len(self.performance_history) < 10:
            return {"predictions_available": False}
        
        # Predict next performance level
        quality_trend = self._calculate_metric_trend("overall_quality")
        current_quality = (
            self.performance_history[-1]["clarity"] +
            self.performance_history[-1]["confidence"] +
            min(self.performance_history[-1]["pace"]/150, 1.0)
        ) / 3
        
        # Simple linear prediction for next few chunks
        predicted_quality = current_quality + (quality_trend["direction"] * 5)  # 5 chunks ahead
        predicted_quality = max(0.0, min(1.0, predicted_quality))  # Clamp to valid range
        
        # Predict time to improvement milestone
        if quality_trend["direction"] > 0:
            current_to_milestone = max(0.8 - current_quality, 0)  # Target 0.8 quality
            chunks_to_milestone = current_to_milestone / quality_trend["direction"] if quality_trend["direction"] > 0 else float('inf')
            time_to_milestone = chunks_to_milestone * 0.1  # Assuming 0.1s per chunk
        else:
            time_to_milestone = float('inf')
        
        return {
            "predictions_available": True,
            "predicted_quality_5_chunks": predicted_quality,
            "quality_trend_direction": "improving" if quality_trend["direction"] > 0 else "declining",
            "trend_confidence": quality_trend["confidence"],
            "estimated_time_to_milestone_seconds": time_to_milestone if time_to_milestone != float('inf') else None,
            "recommendations": self._generate_predictive_recommendations(quality_trend, current_quality)
        }
    
    def _generate_predictive_recommendations(self, trend: Dict[str, float], current_quality: float) -> List[str]:
        """Generate recommendations based on predictive analysis."""
        recommendations = []
        
        if trend["direction"] > 0:
            recommendations.append("Vous êtes sur une bonne trajectoire, continuez !")
            if current_quality < 0.7:
                recommendations.append("Maintenez cet élan pour atteindre un niveau excellent")
        else:
            recommendations.append("Concentrez-vous sur la consistance pour stabiliser vos performances")
            if current_quality > 0.6:
                recommendations.append("Vous avez un bon niveau, travaillez la régularité")
        
        if trend["confidence"] < 0.5:
            recommendations.append("Vos performances varient beaucoup, essayez de trouver votre rythme")
        
        return recommendations
    
    async def _generate_performance_insights(self) -> Dict[str, Any]:
        """Generate comprehensive performance insights."""
        insights = {
            "current_status": self._generate_current_status(),
            "key_strengths": self._identify_key_strengths(),
            "improvement_opportunities": self._identify_improvement_opportunities(),
            "coaching_priorities": self._determine_coaching_priorities(),
            "session_highlights": self._generate_session_highlights()
        }
        
        return insights
    
    def _generate_current_status(self) -> Dict[str, Any]:
        """Generate current performance status."""
        if not self.performance_history:
            return {"status": "initializing", "message": "Collecte des premières données..."}
        
        latest = self.performance_history[-1]
        current_quality = (latest["clarity"] + latest["confidence"] + min(latest["pace"]/150, 1.0)) / 3
        
        if current_quality >= 0.8:
            status = "excellent"
            message = "Performance excellente ! Continuez sur cette lancée."
        elif current_quality >= 0.7:
            status = "good"
            message = "Bonne performance, quelques ajustements pour l'excellence."
        elif current_quality >= 0.6:
            status = "satisfactory"
            message = "Performance correcte, des améliorations sont possibles."
        else:
            status = "needs_improvement"
            message = "Concentrez-vous sur les bases pour améliorer votre performance."
        
        return {
            "status": status,
            "quality_score": current_quality,
            "message": message,
            "session_duration": len(self.performance_history) * 0.1  # Rough estimate
        }
    
    def _identify_key_strengths(self) -> List[str]:
        """Identify key performance strengths."""
        strengths = []
        
        if not self.performance_history:
            return strengths
        
        # Analyze recent performance
        recent_performance = self.performance_history[-10:] if len(self.performance_history) >= 10 else self.performance_history
        
        avg_clarity = statistics.mean([p["clarity"] for p in recent_performance])
        avg_confidence = statistics.mean([p["confidence"] for p in recent_performance])
        avg_pace_score = statistics.mean([min(p["pace"]/150, 1.0) for p in recent_performance])
        
        if avg_clarity >= 0.8:
            strengths.append("Articulation très claire")
        if avg_confidence >= 0.8:
            strengths.append("Grande confiance dans la voix")
        if avg_pace_score >= 0.8:
            strengths.append("Rythme de parole optimal")
        
        # Check consistency
        clarity_consistency = self._calculate_stability(MetricType.VOICE_CLARITY)
        if clarity_consistency >= 0.8:
            strengths.append("Consistance remarquable")
        
        # Check improvement
        improvement_rate = self._calculate_improvement_rate()
        if improvement_rate > 0.1:
            strengths.append("Progression rapide")
        
        return strengths or ["Détermination à s'améliorer"]
    
    def _identify_improvement_opportunities(self) -> List[Dict[str, Any]]:
        """Identify specific improvement opportunities."""
        opportunities = []
        
        if not self.performance_history:
            return opportunities
        
        recent_performance = self.performance_history[-10:] if len(self.performance_history) >= 10 else self.performance_history
        
        avg_clarity = statistics.mean([p["clarity"] for p in recent_performance])
        avg_confidence = statistics.mean([p["confidence"] for p in recent_performance])
        avg_pace = statistics.mean([p["pace"] for p in recent_performance])
        
        if avg_clarity < 0.7:
            opportunities.append({
                "area": "Clarté d'articulation",
                "current_score": avg_clarity,
                "target_score": 0.8,
                "priority": "high",
                "suggestion": "Exercices d'articulation et ouverture de la bouche"
            })
        
        if avg_confidence < 0.7:
            opportunities.append({
                "area": "Confiance vocale",
                "current_score": avg_confidence,
                "target_score": 0.8,
                "priority": "medium",
                "suggestion": "Travail sur la posture et la respiration"
            })
        
        if avg_pace < 100 or avg_pace > 200:
            opportunities.append({
                "area": "Rythme de parole",
                "current_score": min(avg_pace/150, 1.0),
                "target_score": 0.8,
                "priority": "medium",
                "suggestion": f"Ajuster le débit vers 120-180 mots/minute (actuellement {avg_pace:.0f})"
            })
        
        # Check consistency
        overall_variability = self._calculate_overall_variability()
        if overall_variability > 0.3:
            opportunities.append({
                "area": "Consistance générale",
                "current_score": 1.0 - overall_variability,
                "target_score": 0.8,
                "priority": "medium",
                "suggestion": "Travailler la régularité dans tous les aspects"
            })
        
        return opportunities
    
    def _determine_coaching_priorities(self) -> List[Dict[str, Any]]:
        """Determine coaching priorities based on analysis."""
        priorities = []
        opportunities = self._identify_improvement_opportunities()
        
        # Sort by priority and impact
        high_priority = [opp for opp in opportunities if opp["priority"] == "high"]
        medium_priority = [opp for opp in opportunities if opp["priority"] == "medium"]
        
        for i, opp in enumerate(high_priority[:2]):  # Top 2 high priority
            priorities.append({
                "rank": i + 1,
                "area": opp["area"],
                "urgency": "high",
                "expected_impact": "major",
                "coaching_approach": self._suggest_coaching_approach(opp["area"]),
                "timeline": "immediate"
            })
        
        for i, opp in enumerate(medium_priority[:2]):  # Top 2 medium priority
            priorities.append({
                "rank": len(high_priority) + i + 1,
                "area": opp["area"],
                "urgency": "medium",
                "expected_impact": "moderate",
                "coaching_approach": self._suggest_coaching_approach(opp["area"]),
                "timeline": "short_term"
            })
        
        return priorities
    
    def _suggest_coaching_approach(self, area: str) -> str:
        """Suggest coaching approach for specific area."""
        approaches = {
            "Clarté d'articulation": "Exercices pratiques d'articulation avec feedback immédiat",
            "Confiance vocale": "Techniques de respiration et travail postural",
            "Rythme de parole": "Entraînement au métronome et exercices de rythme",
            "Consistance générale": "Routine d'échauffement vocal et auto-monitoring"
        }
        return approaches.get(area, "Coaching personnalisé adapté")
    
    def _generate_session_highlights(self) -> List[Dict[str, Any]]:
        """Generate session highlights and achievements."""
        highlights = []
        
        if len(self.performance_history) < 5:
            return highlights
        
        # Best performance moment
        quality_scores = [
            (p["clarity"] + p["confidence"] + min(p["pace"]/150, 1.0)) / 3
            for p in self.performance_history
        ]
        
        best_idx = quality_scores.index(max(quality_scores))
        highlights.append({
            "type": "peak_performance",
            "timestamp": self.performance_history[best_idx]["timestamp"].isoformat(),
            "score": quality_scores[best_idx],
            "description": f"Meilleure performance à {best_idx * 0.1:.1f}s avec un score de {quality_scores[best_idx]:.2f}"
        })
        
        # Improvement streaks
        improvement_streak = 0
        current_streak = 0
        
        for i in range(1, len(quality_scores)):
            if quality_scores[i] > quality_scores[i-1]:
                current_streak += 1
                improvement_streak = max(improvement_streak, current_streak)
            else:
                current_streak = 0
        
        if improvement_streak >= 3:
            highlights.append({
                "type": "improvement_streak",
                "streak_length": improvement_streak,
                "description": f"Série d'amélioration continue sur {improvement_streak} mesures"
            })
        
        # Consistency achievements
        consistency_scores = []
        window_size = 5
        for i in range(window_size, len(quality_scores)):
            window = quality_scores[i-window_size:i]
            consistency = 1.0 - (statistics.stdev(window) if len(window) > 1 else 0)
            consistency_scores.append(consistency)
        
        if consistency_scores and max(consistency_scores) > 0.9:
            highlights.append({
                "type": "consistency_achievement",
                "score": max(consistency_scores),
                "description": f"Excellente consistance atteinte (score: {max(consistency_scores):.2f})"
            })
        
        return highlights
    
    def _calculate_positive_feedback_ratio(self, feedback_data: Dict[str, Any]) -> float:
        """Calculate ratio of positive feedback."""
        feedback_items = feedback_data.get("feedback_items", [])
        if not feedback_items:
            return 0.0
        
        positive_count = sum(1 for item in feedback_items if hasattr(item, 'type') and item.metadata.get("type", "unknown").value == "positive")
        return positive_count / len(feedback_items)
    
    def _calculate_coaching_engagement(self, feedback_data: Dict[str, Any]) -> float:
        """Calculate coaching engagement score."""
        ai_feedback = feedback_data.get("ai_generated_feedback", {})
        real_time_suggestions = feedback_data.get("real_time_suggestions", [])
        
        # Score based on feedback richness and variety
        engagement_score = 0.0
        
        if ai_feedback.get("feedback_summary"):
            engagement_score += 0.3
        if ai_feedback.get("improvements"):
            engagement_score += 0.3
        if real_time_suggestions:
            engagement_score += 0.4
        
        return min(engagement_score, 1.0)
    
    def _update_session_metrics(self, input_data: Dict[str, Any], metrics_results: Dict[str, Any]):
        """Update session-level metrics."""
        # Track energy levels
        if "current_performance" in metrics_results:
            current_perf = metrics_results["current_performance"]
            energy_level = (current_perf.get("confidence_score", 0) + current_perf.get("voice_activity_ratio", 0)) / 2
            self.session_metrics["energy_levels"].append(energy_level)
        
        # Update consistency tracking
        if "stability_metrics" in metrics_results:
            overall_stability = statistics.mean([
                metrics_results["stability_metrics"].get("pace_stability", 0),
                metrics_results["stability_metrics"].get("volume_stability", 0),
                metrics_results["stability_metrics"].get("clarity_consistency", 0)
            ])
            self.session_metrics["consistency_scores"].append(overall_stability)
    
    def _generate_session_summary(self) -> Dict[str, Any]:
        """Generate comprehensive session summary."""
        session_duration = (datetime.utcnow() - self.session_metrics["session_start_time"]).total_seconds()
        
        return {
            "session_duration_seconds": session_duration,
            "total_chunks_processed": self.session_metrics["total_chunks_processed"],
            "total_speaking_duration": self.session_metrics["total_speaking_duration"],
            "total_words_spoken": self.session_metrics["total_words_spoken"],
            "average_words_per_minute": (
                self.session_metrics["total_words_spoken"] / (self.session_metrics["total_speaking_duration"] / 60)
                if self.session_metrics["total_speaking_duration"] > 0 else 0
            ),
            "feedback_items_generated": self.session_metrics["total_feedback_items"],
            "peak_performance_moments": len(self.session_metrics["peak_performance_moments"]),
            "improvement_milestones": len(self.session_metrics["improvement_milestones"]),
            "average_consistency": (
                statistics.mean(self.session_metrics["consistency_scores"])
                if self.session_metrics["consistency_scores"] else 0.0
            ),
            "average_energy_level": (
                statistics.mean(self.session_metrics["energy_levels"])
                if self.session_metrics["energy_levels"] else 0.0
            )
        }
    
    def _calculate_benchmark_comparisons(self, metrics_results: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate comparisons against benchmarks."""
        comparisons = {}
        
        if "current_performance" in metrics_results:
            current = metrics_results["current_performance"]
            
            for metric, value in current.items():
                if metric in ["pace_wpm", "volume_consistency", "clarity_score"]:
                    benchmark_key = metric if metric in self.benchmarks else metric.replace("_score", "").replace("_wpm", "_wpm")
                    
                    if benchmark_key in self.benchmarks:
                        level = self._determine_performance_level(value, self.benchmarks[benchmark_key])
                        comparisons[metric] = {
                            "current_value": value,
                            "performance_level": level,
                            "benchmark_distance": self._calculate_benchmark_distance(value, benchmark_key)
                        }
        
        return comparisons
    
    def _calculate_benchmark_distance(self, value: float, benchmark_key: str) -> Dict[str, float]:
        """Calculate distance to different benchmark levels."""
        benchmarks = self.benchmarks[benchmark_key]
        distances = {}
        
        if isinstance(benchmarks["excellent"], tuple):
            # Range-based benchmarks
            excellent_range = benchmarks["excellent"]
            good_range = benchmarks["good"]
            
            # Distance to excellent range
            if excellent_range[0] <= value <= excellent_range[1]:
                distances["to_excellent"] = 0.0
            else:
                distances["to_excellent"] = min(
                    abs(value - excellent_range[0]),
                    abs(value - excellent_range[1])
                )
            
            # Distance to good range
            if good_range[0] <= value <= good_range[1]:
                distances["to_good"] = 0.0
            else:
                distances["to_good"] = min(
                    abs(value - good_range[0]),
                    abs(value - good_range[1])
                )
        else:
            # Threshold-based benchmarks
            distances["to_excellent"] = max(0, benchmarks["excellent"] - value)
            distances["to_good"] = max(0, benchmarks["good"] - value)
        
        return distances 