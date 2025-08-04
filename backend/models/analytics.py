"""
AURA Analytics Models

Pydantic models for analytics and performance metrics tracking
with comprehensive data validation and JSON encoding.
"""

from datetime import datetime, date
from typing import Dict, List, Optional, Any, Union
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, ConfigDict
from enum import Enum


class MetricType(str, Enum):
    """Types of metrics that can be tracked."""
    VOICE_PACE = "voice_pace"
    VOICE_VOLUME = "voice_volume"
    VOICE_CLARITY = "voice_clarity"
    PAUSE_FREQUENCY = "pause_frequency"
    FILLER_WORDS = "filler_words"
    SESSION_DURATION = "session_duration"
    ENGAGEMENT_SCORE = "engagement_score"
    OVERALL_PERFORMANCE = "overall_performance"


class AggregationType(str, Enum):
    """Types of data aggregation."""
    AVERAGE = "average"
    MEDIAN = "median"
    MIN = "min"
    MAX = "max"
    SUM = "sum"
    COUNT = "count"
    PERCENTILE = "percentile"


class TimeFrame(str, Enum):
    """Time frames for analytics."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    ALL_TIME = "all_time"


class PerformanceMetric(BaseModel):
    """Individual performance metric data point."""
    
    session_id: UUID = Field(..., description="Session identifier")
    user_id: Optional[str] = Field(None, description="User identifier")
    metric_type: MetricType = Field(..., description="Type of metric")
    value: float = Field(..., description="Metric value")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Measurement timestamp")
    
    # Contextual information
    session_type: Optional[str] = Field(None, description="Type of session")
    presentation_topic: Optional[str] = Field(None, description="Presentation topic")
    duration_seconds: Optional[float] = Field(None, ge=0, description="Session duration")
    
    model_config = ConfigDict(
        use_enum_values=True,
        ser_json_timedelta="float",
        ser_json_bytes="utf8"
    )


class AggregatedMetric(BaseModel):
    """Aggregated metric over a time period."""
    
    metric_type: MetricType = Field(..., description="Type of metric")
    aggregation_type: AggregationType = Field(..., description="How data was aggregated")
    value: float = Field(..., description="Aggregated value")
    
    # Time period
    start_date: date = Field(..., description="Start date of aggregation period")
    end_date: date = Field(..., description="End date of aggregation period")
    time_frame: TimeFrame = Field(..., description="Time frame of aggregation")
    
    # Statistical information
    sample_count: int = Field(..., ge=0, description="Number of samples in aggregation")
    standard_deviation: Optional[float] = Field(None, ge=0, description="Standard deviation of samples")
    
    model_config = ConfigDict(
        use_enum_values=True,
        ser_json_timedelta="float",
        ser_json_bytes="utf8"
    )


class TrendData(BaseModel):
    """Trend analysis data for a specific metric."""
    
    metric_type: MetricType = Field(..., description="Type of metric being tracked")
    data_points: List[AggregatedMetric] = Field(..., description="Time series data points")
    
    # Trend analysis
    trend_direction: str = Field(..., description="Overall trend direction (up/down/stable)")
    trend_strength: float = Field(..., ge=0, le=1, description="Strength of trend (0-1)")
    correlation_coefficient: Optional[float] = Field(None, ge=-1, le=1, description="Correlation coefficient")
    
    # Forecasting (optional)
    forecast_next_period: Optional[float] = Field(None, description="Forecast for next period")
    confidence_interval: Optional[Dict[str, float]] = Field(None, description="Forecast confidence interval")
    
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Analysis generation time")


class UserAnalytics(BaseModel):
    """Comprehensive analytics for a specific user."""
    
    user_id: str = Field(..., description="User identifier")
    analysis_period: Dict[str, date] = Field(..., description="Start and end dates for analysis")
    
    # Session statistics
    total_sessions: int = Field(..., ge=0, description="Total number of sessions")
    total_practice_time: float = Field(..., ge=0, description="Total practice time in seconds")
    average_session_duration: float = Field(..., ge=0, description="Average session duration in seconds")
    
    # Performance metrics
    current_metrics: Dict[MetricType, float] = Field(..., description="Current performance metrics")
    improvement_metrics: Dict[MetricType, float] = Field(..., description="Improvement over time")
    best_scores: Dict[MetricType, float] = Field(..., description="Best scores achieved")
    
    # Trends
    metric_trends: List[TrendData] = Field(default_factory=list, description="Trend analysis for each metric")
    
    # Insights
    strengths: List[str] = Field(default_factory=list, max_length=5, description="Identified strengths")
    improvement_areas: List[str] = Field(default_factory=list, max_length=5, description="Areas needing improvement")
    recommendations: List[str] = Field(default_factory=list, max_length=10, description="Personalized recommendations")
    
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Analytics generation time")
    
    model_config = ConfigDict(
        use_enum_values=True,
        ser_json_timedelta="float",
        ser_json_bytes="utf8"
    )


class SystemMetrics(BaseModel):
    """System-wide performance and usage metrics."""
    
    # Usage statistics
    active_sessions: int = Field(..., ge=0, description="Currently active sessions")
    total_sessions_today: int = Field(..., ge=0, description="Total sessions started today")
    unique_users_today: int = Field(..., ge=0, description="Unique users today")
    
    # Performance metrics
    average_processing_latency: float = Field(..., ge=0, description="Average processing latency in ms")
    peak_processing_latency: float = Field(..., ge=0, description="Peak processing latency in ms")
    system_cpu_usage: float = Field(..., ge=0, le=100, description="System CPU usage percentage")
    system_memory_usage: float = Field(..., ge=0, le=100, description="System memory usage percentage")
    
    # Error tracking
    error_rate: float = Field(..., ge=0, le=100, description="Error rate percentage")
    total_errors_today: int = Field(..., ge=0, description="Total errors today")
    
    # Service health
    gemini_api_status: str = Field(..., description="Gemini API service status")
    redis_status: str = Field(..., description="Redis service status")
    database_status: Optional[str] = Field(None, description="Database service status")
    
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Metrics timestamp")


class ComparisonAnalysis(BaseModel):
    """Comparison analysis between different time periods or users."""
    
    comparison_type: str = Field(..., description="Type of comparison (time_period/user_benchmark)")
    
    # Comparison subjects
    subject_a: Dict[str, Any] = Field(..., description="First comparison subject")
    subject_b: Dict[str, Any] = Field(..., description="Second comparison subject")
    
    # Metric comparisons
    metric_comparisons: Dict[MetricType, Dict[str, float]] = Field(
        ..., description="Detailed metric comparisons"
    )
    
    # Overall analysis
    significant_improvements: List[str] = Field(default_factory=list, description="Significant improvements identified")
    areas_of_concern: List[str] = Field(default_factory=list, description="Areas showing decline")
    statistical_significance: Dict[MetricType, bool] = Field(
        default_factory=dict, description="Statistical significance of changes"
    )
    
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Analysis generation time")


class BenchmarkData(BaseModel):
    """Benchmark data for comparison purposes."""
    
    benchmark_type: str = Field(..., description="Type of benchmark (industry/peer_group/historical)")
    category: str = Field(..., description="Benchmark category or group")
    
    # Benchmark values
    benchmark_metrics: Dict[MetricType, Dict[str, float]] = Field(
        ..., description="Benchmark metric values with percentiles"
    )
    
    # Metadata
    sample_size: int = Field(..., ge=1, description="Number of samples in benchmark")
    last_updated: date = Field(..., description="When benchmark was last updated")
    data_source: str = Field(..., description="Source of benchmark data")
    
    model_config = ConfigDict(
        use_enum_values=True
    )


class AnalyticsQuery(BaseModel):
    """Query parameters for analytics requests."""
    
    # Time range
    start_date: Optional[date] = Field(None, description="Start date for analysis")
    end_date: Optional[date] = Field(None, description="End date for analysis")
    time_frame: Optional[TimeFrame] = Field(None, description="Predefined time frame")
    
    # Filters
    user_ids: Optional[List[str]] = Field(None, description="Specific user IDs to include")
    session_types: Optional[List[str]] = Field(None, description="Session types to include")
    metric_types: Optional[List[MetricType]] = Field(None, description="Specific metrics to analyze")
    
    # Aggregation
    aggregation_type: AggregationType = Field(default=AggregationType.AVERAGE, description="How to aggregate data")
    include_trends: bool = Field(default=False, description="Include trend analysis")
    include_comparisons: bool = Field(default=False, description="Include comparison analysis")
    
    @field_validator('end_date')
    @classmethod
    def validate_date_range(cls, v, info):
        """Ensure end_date is after start_date."""
        values = info.data if hasattr(info, "data") else {}
        start = values.get('start_date')
        if v is not None and start is not None and v <= start:
            raise ValueError('end_date must be after start_date')
        return v


class AnalyticsResponse(BaseModel):
    """Response model for analytics queries."""
    
    query: AnalyticsQuery = Field(..., description="Original query parameters")
    
    # Results
    aggregated_metrics: List[AggregatedMetric] = Field(default_factory=list, description="Aggregated metric results")
    trends: List[TrendData] = Field(default_factory=list, description="Trend analysis results")
    comparisons: List[ComparisonAnalysis] = Field(default_factory=list, description="Comparison analysis results")
    
    # Metadata
    total_records: int = Field(..., ge=0, description="Total records processed")
    processing_time_ms: int = Field(..., ge=0, description="Query processing time in milliseconds")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Response generation time")
    
    model_config = ConfigDict(
        use_enum_values=True,
        ser_json_timedelta="float",
        ser_json_bytes="utf8"
    )