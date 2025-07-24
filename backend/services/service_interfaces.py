"""
Service Interfaces for AURA

Defines abstract interfaces for all services to ensure consistent
contracts and enable proper dependency injection.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, AsyncIterator
from uuid import UUID

from models.session import PresentationSessionData
from models.feedback import RealTimeFeedback, SessionFeedback
from utils.service_container import IService


class IAudioService(IService):
    """Interface for audio processing services."""
    
    @abstractmethod
    async def process_audio_chunk(
        self, 
        audio_data: bytes, 
        session_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Process a chunk of audio data."""
        pass
    
    @abstractmethod
    async def validate_audio_format(self, audio_data: bytes) -> bool:
        """Validate audio format and quality."""
        pass
    
    @abstractmethod
    async def extract_audio_features(self, audio_data: bytes) -> Dict[str, Any]:
        """Extract audio features for analysis."""
        pass


class IGeminiService(IService):
    """Interface for Gemini AI services."""
    
    @abstractmethod
    async def generate_feedback(
        self, 
        analysis_data: Dict[str, Any], 
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate AI feedback based on analysis."""
        pass
    
    @abstractmethod
    async def analyze_presentation(
        self, 
        session_data: PresentationSessionData
    ) -> Dict[str, Any]:
        """Analyze presentation performance."""
        pass
    
    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Check Gemini service health."""
        pass


class IStorageService(IService):
    """Interface for storage services."""
    
    @abstractmethod
    async def store_session_data(
        self, 
        session_id: UUID, 
        data: Dict[str, Any]
    ) -> bool:
        """Store session data."""
        pass
    
    @abstractmethod
    async def retrieve_session_data(self, session_id: UUID) -> Optional[Dict[str, Any]]:
        """Retrieve session data."""
        pass
    
    @abstractmethod
    async def store_audio_file(
        self, 
        session_id: UUID, 
        audio_data: bytes, 
        metadata: Dict[str, Any]
    ) -> str:
        """Store audio file and return file path."""
        pass
    
    @abstractmethod
    async def delete_session_data(self, session_id: UUID) -> bool:
        """Delete session data."""
        pass


class IAuthService(IService):
    """Interface for authentication services."""
    
    @abstractmethod
    async def authenticate_user(
        self, 
        email_or_username: str, 
        password: str
    ) -> Optional[Dict[str, Any]]:
        """Authenticate user credentials."""
        pass
    
    @abstractmethod
    async def create_access_token(self, user_data: Dict[str, Any]) -> str:
        """Create JWT access token."""
        pass
    
    @abstractmethod
    async def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token."""
        pass
    
    @abstractmethod
    async def refresh_token(self, refresh_token: str) -> Optional[str]:
        """Refresh access token."""
        pass


class ICacheService(IService):
    """Interface for caching services."""
    
    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        pass
    
    @abstractmethod
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None
    ) -> bool:
        """Set value in cache with optional TTL."""
        pass
    
    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete value from cache."""
        pass
    
    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        pass
    
    @abstractmethod
    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern."""
        pass


class IMetricsService(IService):
    """Interface for metrics and monitoring services."""
    
    @abstractmethod
    async def record_metric(
        self, 
        name: str, 
        value: float, 
        tags: Optional[Dict[str, str]] = None
    ) -> None:
        """Record a metric value."""
        pass
    
    @abstractmethod
    async def increment_counter(
        self, 
        name: str, 
        tags: Optional[Dict[str, str]] = None
    ) -> None:
        """Increment a counter metric."""
        pass
    
    @abstractmethod
    async def record_histogram(
        self, 
        name: str, 
        value: float, 
        tags: Optional[Dict[str, str]] = None
    ) -> None:
        """Record a histogram value."""
        pass
    
    @abstractmethod
    async def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics."""
        pass


class INotificationService(IService):
    """Interface for notification services."""
    
    @abstractmethod
    async def send_notification(
        self, 
        user_id: UUID, 
        message: str, 
        notification_type: str = "info"
    ) -> bool:
        """Send notification to user."""
        pass
    
    @abstractmethod
    async def send_email(
        self, 
        to_email: str, 
        subject: str, 
        body: str, 
        html_body: Optional[str] = None
    ) -> bool:
        """Send email notification."""
        pass
    
    @abstractmethod
    async def get_user_notifications(
        self, 
        user_id: UUID, 
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get user notifications."""
        pass


class IAnalyticsService(IService):
    """Interface for analytics services."""
    
    @abstractmethod
    async def track_event(
        self, 
        event_name: str, 
        user_id: Optional[UUID] = None, 
        properties: Optional[Dict[str, Any]] = None
    ) -> None:
        """Track analytics event."""
        pass
    
    @abstractmethod
    async def get_session_analytics(
        self, 
        session_id: UUID
    ) -> Dict[str, Any]:
        """Get analytics for a session."""
        pass
    
    @abstractmethod
    async def get_user_analytics(
        self, 
        user_id: UUID, 
        date_range: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Get analytics for a user."""
        pass


class IEventBus(IService):
    """Interface for event bus services."""
    
    @abstractmethod
    async def publish(
        self, 
        event_type: str, 
        data: Dict[str, Any], 
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Publish an event."""
        pass
    
    @abstractmethod
    async def subscribe(
        self, 
        event_type: str, 
        handler: callable
    ) -> str:
        """Subscribe to events of a specific type."""
        pass
    
    @abstractmethod
    async def unsubscribe(self, subscription_id: str) -> bool:
        """Unsubscribe from events."""
        pass
    
    @abstractmethod
    async def get_event_history(
        self, 
        event_type: Optional[str] = None, 
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get event history."""
        pass


class IHealthCheckService(IService):
    """Interface for health check services."""
    
    @abstractmethod
    async def check_database_health(self) -> Dict[str, Any]:
        """Check database connectivity and health."""
        pass
    
    @abstractmethod
    async def check_external_services(self) -> Dict[str, Any]:
        """Check external service dependencies."""
        pass
    
    @abstractmethod
    async def get_system_metrics(self) -> Dict[str, Any]:
        """Get system performance metrics."""
        pass
    
    @abstractmethod
    async def get_overall_health(self) -> Dict[str, Any]:
        """Get overall system health status."""
        pass


class IConfigurationService(IService):
    """Interface for configuration services."""
    
    @abstractmethod
    async def get_config(self, key: str, default: Any = None) -> Any:
        """Get configuration value."""
        pass
    
    @abstractmethod
    async def set_config(self, key: str, value: Any) -> bool:
        """Set configuration value."""
        pass
    
    @abstractmethod
    async def get_all_config(self) -> Dict[str, Any]:
        """Get all configuration values."""
        pass
    
    @abstractmethod
    async def reload_config(self) -> bool:
        """Reload configuration from source."""
        pass


class ISecurityService(IService):
    """Interface for security services."""
    
    @abstractmethod
    async def hash_password(self, password: str) -> str:
        """Hash password securely."""
        pass
    
    @abstractmethod
    async def verify_password(self, password: str, hashed: str) -> bool:
        """Verify password against hash."""
        pass
    
    @abstractmethod
    async def generate_secure_token(self, length: int = 32) -> str:
        """Generate secure random token."""
        pass
    
    @abstractmethod
    async def encrypt_data(self, data: str) -> str:
        """Encrypt sensitive data."""
        pass
    
    @abstractmethod
    async def decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data."""
        pass
    
    @abstractmethod
    async def validate_input(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and sanitize input data."""
        pass