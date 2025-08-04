"""
AURA Feedback Models

Pydantic models for feedback data with comprehensive validation
and metadata handling for presentation coaching feedback.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, ConfigDict
from enum import Enum


class FeedbackType(str, Enum):
    """Types of feedback that can be provided."""
    VOICE_PACE = "voice_pace"
    VOICE_VOLUME = "voice_volume"
    VOICE_CLARITY = "voice_clarity"
    FILLER_WORDS = "filler_words"
    PAUSE_FREQUENCY = "pause_frequency"
    STRUCTURE = "structure"
    ENGAGEMENT = "engagement"
    CONFIDENCE = "confidence"


class FeedbackSeverity(str, Enum):
    """Severity levels for feedback."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class VoiceMetrics(BaseModel):
    """Voice analysis metrics with validation."""
    
    pace_wpm: float = Field(..., ge=0, le=500, description="Words per minute")
    pause_frequency: float = Field(..., ge=0, description="Pauses per minute")
    volume_consistency: float = Field(..., ge=0, le=1, description="Volume consistency score")
    clarity_score: float = Field(..., ge=0, le=1, description="Speech clarity score")
    filler_word_count: int = Field(..., ge=0, description="Number of filler words detected")
    
    model_config = ConfigDict(
        ser_json_timedelta="float",
        ser_json_bytes="utf8"
    )


class FeedbackItem(BaseModel):
    """Individual feedback item with actionable suggestions."""
    
    id: UUID = Field(..., description="Unique feedback item identifier")
    type: FeedbackType = Field(..., description="Type of feedback")
    severity: FeedbackSeverity = Field(..., description="Feedback severity level")
    message: str = Field(..., min_length=1, max_length=500, description="Feedback message")
    suggestion: str = Field(..., min_length=1, max_length=1000, description="Actionable suggestion")
    confidence: float = Field(..., ge=0, le=1, description="AI confidence in this feedback")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="When feedback was generated")
    
    # Optional contextual data
    audio_segment_start: Optional[float] = Field(None, ge=0, description="Start time of relevant audio segment")
    audio_segment_end: Optional[float] = Field(None, ge=0, description="End time of relevant audio segment")
    detected_text: Optional[str] = Field(None, description="Transcribed text related to feedback")
    
    @field_validator('audio_segment_end')
    @classmethod
    def validate_audio_segment(cls, v, info):
        """Ensure end time is after start time."""
        values = info.data if hasattr(info, "data") else {}
        start = values.get('audio_segment_start')
        if v is not None and start is not None:
            if v <= start:
                raise ValueError('audio_segment_end must be greater than audio_segment_start')
        return v


class SessionFeedback(BaseModel):
    """Complete feedback for a presentation session."""
    
    session_id: UUID = Field(..., description="Session identifier")
    overall_score: float = Field(..., ge=0, le=100, description="Overall presentation score")
    voice_metrics: VoiceMetrics = Field(..., description="Voice analysis metrics")
    feedback_items: List[FeedbackItem] = Field(..., description="Individual feedback items")
    
    # Summary statistics
    total_duration: float = Field(..., ge=0, description="Total session duration in seconds")
    words_spoken: int = Field(..., ge=0, description="Total words spoken")
    effective_speaking_time: float = Field(..., ge=0, description="Time spent speaking (excluding pauses)")
    
    # Improvement areas
    strengths: List[str] = Field(default_factory=list, description="Identified strengths")
    improvement_areas: List[str] = Field(default_factory=list, description="Areas for improvement")
    
    # Metadata
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="When feedback was generated")
    model_version: str = Field(..., description="AI model version used")
    processing_time_ms: int = Field(..., ge=0, description="Processing time in milliseconds")
    
    @field_validator('effective_speaking_time')
    @classmethod
    def validate_effective_speaking_time(cls, v, info):
        """Ensure effective speaking time doesn't exceed total duration."""
        values = info.data if hasattr(info, "data") else {}
        total = values.get('total_duration')
        if total is not None and v is not None and v > total:
            raise ValueError('effective_speaking_time cannot exceed total_duration')
        return v


class RealTimeFeedback(BaseModel):
    """Real-time feedback for streaming audio processing."""
    
    session_id: UUID = Field(..., description="Session identifier")
    chunk_id: str = Field(..., description="Audio chunk identifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Processing timestamp")
    
    # Current metrics
    current_pace: Optional[float] = Field(None, ge=0, le=500, description="Current speaking pace")
    current_volume: Optional[float] = Field(None, ge=0, le=1, description="Current volume level")
    current_clarity: Optional[float] = Field(None, ge=0, le=1, description="Current clarity score")
    
    # Immediate feedback
    immediate_suggestions: List[str] = Field(default_factory=list, description="Immediate actionable suggestions")
    alerts: List[FeedbackItem] = Field(default_factory=list, description="Critical alerts requiring immediate attention")
    
    # Progress indicators
    session_progress: float = Field(..., ge=0, le=1, description="Session completion progress")
    improvement_trend: Optional[str] = Field(None, description="Trend indicator (improving/stable/declining)")


class FeedbackSummary(BaseModel):
    """High-level summary of session feedback."""
    
    session_id: UUID = Field(..., description="Session identifier")
    overall_rating: str = Field(..., description="Overall performance rating")
    key_insights: List[str] = Field(..., max_length=5, description="Top 5 key insights")
    priority_improvements: List[str] = Field(..., max_length=3, description="Top 3 priority improvements")
    
    # Comparative metrics
    improvement_from_last_session: Optional[float] = Field(None, description="Improvement percentage from last session")
    benchmark_comparison: Optional[Dict[str, float]] = Field(None, description="Comparison with benchmarks")
    
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Summary generation time")


class ErrorResponse(BaseModel):
    """Standardized error response format."""
    
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")
    request_id: str = Field(..., description="Request identifier for tracking") 