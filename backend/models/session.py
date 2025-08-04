"""
AURA Session Models

Pydantic models for session management with UUID tracking,
timeout handling, and state management.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4
from pydantic import BaseModel, Field, field_validator, ConfigDict
from enum import Enum
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSON

from app.database import Base


class SessionStatus(str, Enum):
    """Session status enumeration."""
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    ERROR = "error"


class SupportedLanguage(str, Enum):
    """Supported languages for AURA coaching."""
    FRENCH = "fr"
    ENGLISH = "en"
    # Future languages can be added here
    # SPANISH = "es"
    # GERMAN = "de"


class SessionType(str, Enum):
    """Types of presentation sessions."""
    PRACTICE = "practice"
    LIVE_COACHING = "live_coaching"
    EVALUATION = "evaluation"
    TRAINING = "training"


class AudioConfig(BaseModel):
    """Audio configuration for a session."""
    
    sample_rate: int = Field(default=16000, ge=8000, le=48000, description="Audio sample rate in Hz")
    chunk_size: int = Field(default=1600, ge=160, le=16000, description="Audio chunk size for processing")
    format: str = Field(default="wav", description="Audio format")
    channels: int = Field(default=1, ge=1, le=2, description="Number of audio channels")
    
    # Processing settings
    enable_noise_reduction: bool = Field(default=True, description="Enable noise reduction")
    enable_echo_cancellation: bool = Field(default=True, description="Enable echo cancellation")
    volume_normalization: bool = Field(default=True, description="Enable volume normalization")


class SessionConfig(BaseModel):
    """Configuration settings for a presentation session."""
    
    # Session behavior
    session_type: SessionType = Field(default=SessionType.PRACTICE, description="Type of presentation session")
    language: SupportedLanguage = Field(default=SupportedLanguage.FRENCH, description="Primary language for the session")
    max_duration: int = Field(default=3600, ge=60, le=7200, description="Maximum session duration in seconds")
    auto_pause_threshold: int = Field(default=30, ge=5, le=300, description="Auto-pause after silence (seconds)")
    
    # Audio configuration
    audio_config: AudioConfig = Field(default_factory=AudioConfig, description="Audio processing configuration")
    
    # Feedback settings
    feedback_frequency: int = Field(default=5, ge=1, le=30, description="Feedback frequency (chunks)")
    real_time_feedback: bool = Field(default=True, description="Enable real-time feedback")
    detailed_analysis: bool = Field(default=True, description="Enable detailed voice analysis")
    ai_coaching: bool = Field(default=True, description="Enable AI-powered coaching")
    
    # Privacy settings
    store_audio: bool = Field(default=False, description="Store audio recordings")
    share_analytics: bool = Field(default=False, description="Share analytics for improvement")


class SessionState(BaseModel):
    """Runtime state of a session."""
    
    current_chunk: int = Field(default=0, description="Current audio chunk number")
    total_chunks: int = Field(default=0, description="Total chunks processed")
    speaking_time: float = Field(default=0.0, description="Total speaking time in seconds")
    pause_time: float = Field(default=0.0, description="Total pause time in seconds")
    words_detected: int = Field(default=0, description="Total words detected")
    last_activity: Optional[datetime] = Field(default=None, description="Last activity timestamp")
    
    # Performance tracking
    average_pace: float = Field(default=0.0, description="Average speaking pace (WPM)")
    consistency_score: float = Field(default=0.0, description="Voice consistency score")
    engagement_level: float = Field(default=0.0, description="Estimated engagement level")
    
    # Error tracking
    processing_errors: int = Field(default=0, description="Number of processing errors")
    last_error: Optional[str] = Field(default=None, description="Last error message")


class SessionMetadata(BaseModel):
    """Additional session metadata."""
    
    user_agent: Optional[str] = Field(default=None, description="Client user agent")
    ip_address: Optional[str] = Field(default=None, description="Client IP address")
    platform: Optional[str] = Field(default=None, description="Client platform")
    session_tags: List[str] = Field(default_factory=list, description="Custom session tags")
    notes: Optional[str] = Field(default=None, description="Session notes")
    
    # Quality metrics
    audio_quality: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Audio quality score")
    connection_quality: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Connection quality score")


class PresentationSessionData(BaseModel):
    """
    Pydantic model for presentation session data validation and serialization.
    
    This model tracks the full lifecycle of a session from creation to completion,
    including configuration, state, and metadata.
    """
    
    # Core identification
    id: UUID = Field(default_factory=uuid4, description="Unique session identifier")
    user_id: str = Field(..., description="User identifier")
    
    # Session configuration and settings
    config: SessionConfig = Field(default_factory=SessionConfig, description="Session configuration")
    
    # Session lifecycle
    status: SessionStatus = Field(default=SessionStatus.ACTIVE, description="Current session status")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Session creation timestamp")
    started_at: Optional[datetime] = Field(default=None, description="Session start timestamp")
    ended_at: Optional[datetime] = Field(default=None, description="Session end timestamp")
    expires_at: Optional[datetime] = Field(default=None, description="Session expiration timestamp")
    
    # Session content
    title: Optional[str] = Field(default=None, max_length=200, description="Session title")
    description: Optional[str] = Field(default=None, max_length=1000, description="Session description")
    
    # Runtime state
    state: SessionState = Field(default_factory=SessionState, description="Current session state")
    
    # Additional metadata
    metadata: SessionMetadata = Field(default_factory=SessionMetadata, description="Session metadata")
    
    # Computed properties
    duration_seconds: Optional[float] = Field(default=None, description="Session duration in seconds")
    
    @field_validator('expires_at')
    @classmethod
    def set_expiration(cls, v, info):
        """Set expiration time based on max_duration if not provided."""
        values = info.data if hasattr(info, "data") else {}
        if v is None:
            created_at = values.get('created_at')
            config = values.get('config')
            if created_at is not None and config is not None:
                return created_at + timedelta(seconds=config.max_duration)
        return v
    
    @field_validator('duration_seconds')
    @classmethod
    def calculate_duration(cls, v, info):
        """Calculate session duration if start and end times are available."""
        values = info.data if hasattr(info, "data") else {}
        started = values.get('started_at')
        ended = values.get('ended_at')
        if started and ended:
            return (ended - started).total_seconds()
        return v
    
    @property
    def is_active(self) -> bool:
        """Check if session is currently active."""
        return self.status == SessionStatus.ACTIVE
    
    @property
    def is_expired(self) -> bool:
        """Check if session has expired."""
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False
    
    @property
    def time_remaining(self) -> Optional[timedelta]:
        """Get remaining time before expiration."""
        if self.expires_at:
            remaining = self.expires_at - datetime.utcnow()
            return remaining if remaining.total_seconds() > 0 else timedelta(0)
        return None
    
    def start_session(self) -> None:
        """Mark session as started."""
        if not self.started_at:
            self.started_at = datetime.utcnow()
            self.status = SessionStatus.ACTIVE
    
    def pause_session(self) -> None:
        """Pause the session."""
        self.status = SessionStatus.PAUSED
    
    def resume_session(self) -> None:
        """Resume a paused session."""
        if self.status == SessionStatus.PAUSED:
            self.status = SessionStatus.ACTIVE
    
    def complete_session(self) -> None:
        """Mark session as completed."""
        if not self.ended_at:
            self.ended_at = datetime.utcnow()
        self.status = SessionStatus.COMPLETED
        
        # Calculate final duration
        if self.started_at and self.ended_at:
            self.duration_seconds = (self.ended_at - self.started_at).total_seconds()
    
    def cancel_session(self) -> None:
        """Cancel the session."""
        if not self.ended_at:
            self.ended_at = datetime.utcnow()
        self.status = SessionStatus.CANCELLED
    
    def mark_error(self, error_message: str) -> None:
        """Mark session as having an error."""
        self.status = SessionStatus.ERROR
        self.state.processing_errors += 1
        self.state.last_error = error_message
    
    model_config = ConfigDict(
        use_enum_values=True,
        ser_json_timedelta="float",
        ser_json_bytes="utf8"
    )


# ===== REQUEST/RESPONSE MODELS =====

class CreateSessionRequest(BaseModel):
    """Request model for creating a new session."""
    
    user_id: str = Field(..., description="User identifier", min_length=1, max_length=100)
    config: SessionConfig = Field(default_factory=SessionConfig, description="Session configuration")
    title: Optional[str] = Field(default=None, max_length=200, description="Session title")
    description: Optional[str] = Field(default=None, max_length=1000, description="Session description")
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user123",
                "config": {
                    "session_type": "practice",
                    "language": "fr",
                    "real_time_feedback": True,
                    "ai_coaching": True
                },
                "title": "Ma session de pratique",
                "description": "Session pour améliorer ma présentation"
            }
        }


class UpdateSessionRequest(BaseModel):
    """Request model for updating session configuration."""
    
    config: Optional[SessionConfig] = Field(default=None, description="Updated session configuration")
    title: Optional[str] = Field(default=None, max_length=200, description="Updated session title")
    description: Optional[str] = Field(default=None, max_length=1000, description="Updated session description")
    status: Optional[SessionStatus] = Field(default=None, description="Updated session status")
    
    class Config:
        json_schema_extra = {
            "example": {
                "config": {
                    "real_time_feedback": False,
                    "feedback_frequency": 10
                },
                "title": "Titre mis à jour",
                "status": "paused"
            }
        } 


class PresentationSessionResponse(BaseModel):
    """Response model for presentation session."""
    id: str
    user_id: Optional[str] = None
    title: str
    session_type: str
    language: SupportedLanguage
    status: SessionStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration: int = 0
    config: Optional[Dict[str, Any]] = None
    stats: Optional[Dict[str, Any]] = None
    feedback_summary: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class SessionsResponse(BaseModel):
    """Response model for paginated sessions list."""
    data: List[PresentationSessionResponse]
    total: int
    page: int
    limit: int
    
    model_config = ConfigDict(from_attributes=True)

# ============================================================================
# MODÈLES SQLALCHEMY (BASE DE DONNÉES)
# ============================================================================

class PresentationSession(Base):
    __tablename__ = "presentation_sessions"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Configuration de session
    title = Column(String(200), nullable=False)
    session_type = Column(String(50), nullable=False)  # practice, presentation, training
    language = Column(String(10), default="fr")
    
    # État de la session
    status = Column(String(20), default="active")  # active, paused, completed, expired
    
    # Métadonnées temporelles
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    duration = Column(Integer, default=0)  # en secondes
    
    # Configuration et données
    config = Column(JSON, nullable=True)
    stats = Column(JSON, nullable=True)
    feedback_summary = Column(Text, nullable=True)
    
    # Relations
    user = relationship("User", back_populates="sessions")
    
    def __repr__(self):
        return f"<PresentationSession {self.id} ({self.title})>" 