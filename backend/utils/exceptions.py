"""
Custom exception classes for AURA application.

Comprehensive exception hierarchy covering all system components including
audio processing, AI integration, pipeline operations, and service management.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime


class AuraException(Exception):
    """
    Base exception class for all AURA-specific errors.
    
    Provides structured error information with context and metadata
    for comprehensive error handling and logging.
    """
    
    def __init__(
        self, 
        message: str, 
        error_code: str = "AURA_ERROR",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize AURA exception.
        
        Args:
            message: Human-readable error message
            error_code: Unique error code for categorization
            status_code: HTTP status code for API responses
            details: Additional error context and metadata
        """
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for serialization."""
        return {
            "error_code": self.error_code,
            "message": self.message,
            "status_code": self.status_code,
            "details": self.details,
            "timestamp": self.timestamp.isoformat()
        }
    
    def __str__(self) -> str:
        return f"[{self.error_code}] {self.message}"


# ===== SESSION MANAGEMENT EXCEPTIONS =====

class SessionException(AuraException):
    """Base exception for session-related errors."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="SESSION_ERROR",
            status_code=400,
            details=details
        )


class SessionNotFoundError(SessionException):
    """Exception raised when a session cannot be found."""
    
    def __init__(self, session_id: str, details: Optional[Dict[str, Any]] = None):
        message = f"Session {session_id} not found"
        super().__init__(
            message=message,
            details={**(details or {}), "session_id": session_id}
        )
        self.error_code = "SESSION_NOT_FOUND"
        self.status_code = 404


class SessionExpiredError(SessionException):
    """Exception raised when a session has expired."""
    
    def __init__(self, session_id: str, expired_at: datetime, details: Optional[Dict[str, Any]] = None):
        message = f"Session {session_id} expired at {expired_at.isoformat()}"
        super().__init__(
            message=message,
            details={
                **(details or {}), 
                "session_id": session_id,
                "expired_at": expired_at.isoformat()
            }
        )
        self.error_code = "SESSION_EXPIRED"
        self.status_code = 410


class SessionStateError(SessionException):
    """Exception raised when session is in invalid state for operation."""
    
    def __init__(self, session_id: str, current_state: str, required_state: str, details: Optional[Dict[str, Any]] = None):
        message = f"Session {session_id} is in state '{current_state}', required '{required_state}'"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "session_id": session_id,
                "current_state": current_state,
                "required_state": required_state
            }
        )
        self.error_code = "SESSION_INVALID_STATE"


# ===== AUDIO PROCESSING EXCEPTIONS =====

class AudioProcessingException(AuraException):
    """Base exception for audio processing related errors."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="AUDIO_PROCESSING_ERROR",
            status_code=400,
            details=details
        )


class InvalidAudioFormatError(AudioProcessingException):
    """Exception raised when audio format is not supported."""
    
    def __init__(self, format_provided: str, supported_formats: list, details: Optional[Dict[str, Any]] = None):
        message = f"Audio format '{format_provided}' not supported. Supported formats: {', '.join(supported_formats)}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "format_provided": format_provided,
                "supported_formats": supported_formats
            }
        )
        self.error_code = "INVALID_AUDIO_FORMAT"


class AudioTooLargeError(AudioProcessingException):
    """Exception raised when audio file exceeds size limits."""
    
    def __init__(self, file_size: int, max_size: int, details: Optional[Dict[str, Any]] = None):
        message = f"Audio file size {file_size} bytes exceeds maximum {max_size} bytes"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "file_size": file_size,
                "max_size": max_size,
                "size_mb": round(file_size / 1024 / 1024, 2),
                "max_size_mb": round(max_size / 1024 / 1024, 2)
            }
        )
        self.error_code = "AUDIO_TOO_LARGE"
        self.status_code = 413


class AudioQualityError(AudioProcessingException):
    """Exception raised when audio quality is insufficient for processing."""
    
    def __init__(self, quality_score: float, min_quality: float, details: Optional[Dict[str, Any]] = None):
        message = f"Audio quality {quality_score:.2f} below minimum threshold {min_quality:.2f}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "quality_score": quality_score,
                "min_quality": min_quality,
                "quality_issues": details.get("quality_issues", []) if details else []
            }
        )
        self.error_code = "AUDIO_QUALITY_INSUFFICIENT"


class AudioBufferError(AudioProcessingException):
    """Exception raised for audio buffer operations."""
    
    def __init__(self, operation: str, buffer_state: str, details: Optional[Dict[str, Any]] = None):
        message = f"Audio buffer error during '{operation}': {buffer_state}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "operation": operation,
                "buffer_state": buffer_state
            }
        )
        self.error_code = "AUDIO_BUFFER_ERROR"


# ===== AI MODEL EXCEPTIONS =====

class AIModelException(AuraException):
    """Base exception for AI model related errors."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="AI_MODEL_ERROR",
            status_code=500,
            details=details
        )


class AIModelUnavailableError(AIModelException):
    """Exception raised when AI model is unavailable."""
    
    def __init__(self, model_name: str, reason: str = "Unknown", details: Optional[Dict[str, Any]] = None):
        message = f"AI model '{model_name}' unavailable: {reason}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "model_name": model_name,
                "unavailable_reason": reason
            }
        )
        self.error_code = "AI_MODEL_UNAVAILABLE"
        self.status_code = 503


class AIModelQuotaExceededError(AuraException):
    """Exception raised when AI model quota is exceeded."""
    
    def __init__(self, model_name: str, quota_type: str, reset_time: Optional[datetime] = None, details: Optional[Dict[str, Any]] = None):
        message = f"AI model '{model_name}' quota exceeded for {quota_type}"
        if reset_time:
            message += f", resets at {reset_time.isoformat()}"
        
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "model_name": model_name,
                "quota_type": quota_type,
                "reset_time": reset_time.isoformat() if reset_time else None
            }
        )
        self.error_code = "AI_MODEL_QUOTA_EXCEEDED"
        self.status_code = 429


class AIModelTimeoutError(AuraException):
    """Exception raised when AI model request times out."""
    
    def __init__(self, model_name: str, timeout_seconds: float, operation: str, details: Optional[Dict[str, Any]] = None):
        message = f"AI model '{model_name}' timeout after {timeout_seconds}s during {operation}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "model_name": model_name,
                "timeout_seconds": timeout_seconds,
                "operation": operation
            }
        )
        self.error_code = "AI_MODEL_TIMEOUT"
        self.status_code = 408


class AIModelResponseError(AuraException):
    """Exception raised when AI model response is invalid or unparseable."""
    
    def __init__(self, model_name: str, response_issue: str, raw_response: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        message = f"AI model '{model_name}' response error: {response_issue}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "model_name": model_name,
                "response_issue": response_issue,
                "raw_response": raw_response[:500] + "..." if raw_response and len(raw_response) > 500 else raw_response
            }
        )
        self.error_code = "AI_MODEL_RESPONSE_ERROR"


# ===== PIPELINE EXCEPTIONS =====

class PipelineException(AuraException):
    """Base exception for GenAI Processors pipeline errors."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="PIPELINE_ERROR",
            status_code=500,
            details=details
        )


class ProcessorException(PipelineException):
    """Exception raised by individual processors."""
    
    def __init__(self, processor_name: str, error_message: str, details: Optional[Dict[str, Any]] = None):
        message = f"Processor '{processor_name}' error: {error_message}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "processor_name": processor_name,
                "processor_error": error_message
            }
        )
        self.error_code = "PROCESSOR_ERROR"


class PipelineTimeoutError(PipelineException):
    """Exception raised when pipeline processing times out."""
    
    def __init__(self, pipeline_stage: str, timeout_seconds: float, details: Optional[Dict[str, Any]] = None):
        message = f"Pipeline timeout in stage '{pipeline_stage}' after {timeout_seconds}s"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "pipeline_stage": pipeline_stage,
                "timeout_seconds": timeout_seconds
            }
        )
        self.error_code = "PIPELINE_TIMEOUT"
        self.status_code = 408


class PipelineConfigurationError(PipelineException):
    """Exception raised for pipeline configuration errors."""
    
    def __init__(self, config_issue: str, config_section: str, details: Optional[Dict[str, Any]] = None):
        message = f"Pipeline configuration error in '{config_section}': {config_issue}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "config_issue": config_issue,
                "config_section": config_section
            }
        )
        self.error_code = "PIPELINE_CONFIG_ERROR"
        self.status_code = 400


class PipelineResourceError(PipelineException):
    """Exception raised when pipeline lacks necessary resources."""
    
    def __init__(self, resource_type: str, resource_name: str, availability_issue: str, details: Optional[Dict[str, Any]] = None):
        message = f"Pipeline resource error: {resource_type} '{resource_name}' - {availability_issue}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "resource_type": resource_type,
                "resource_name": resource_name,
                "availability_issue": availability_issue
            }
        )
        self.error_code = "PIPELINE_RESOURCE_ERROR"
        self.status_code = 503


# ===== WEBSOCKET EXCEPTIONS =====

class WebSocketException(AuraException):
    """WebSocket-related exceptions."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="WEBSOCKET_ERROR",
            status_code=400,
            details=details
        )


class WebSocketConnectionError(WebSocketException):
    """Exception raised for WebSocket connection issues."""
    
    def __init__(self, session_id: str, connection_issue: str, details: Optional[Dict[str, Any]] = None):
        message = f"WebSocket connection error for session {session_id}: {connection_issue}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "session_id": session_id,
                "connection_issue": connection_issue
            }
        )
        self.error_code = "WEBSOCKET_CONNECTION_ERROR"


class WebSocketMessageError(WebSocketException):
    """Exception raised for invalid WebSocket messages."""
    
    def __init__(self, message_type: str, validation_error: str, details: Optional[Dict[str, Any]] = None):
        message = f"Invalid WebSocket message '{message_type}': {validation_error}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "message_type": message_type,
                "validation_error": validation_error
            }
        )
        self.error_code = "WEBSOCKET_MESSAGE_ERROR"


# ===== STORAGE EXCEPTIONS =====

class StorageException(AuraException):
    """Base exception for storage-related errors."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="STORAGE_ERROR",
            status_code=500,
            details=details
        )


class StorageConnectionError(StorageException):
    """Exception raised when storage connection fails."""
    
    def __init__(self, storage_type: str, connection_details: str, details: Optional[Dict[str, Any]] = None):
        message = f"Storage connection error ({storage_type}): {connection_details}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "storage_type": storage_type,
                "connection_details": connection_details
            }
        )
        self.error_code = "STORAGE_CONNECTION_ERROR"
        self.status_code = 503


class StorageCapacityError(StorageException):
    """Exception raised when storage capacity is exceeded."""
    
    def __init__(self, operation: str, capacity_limit: str, current_usage: str, details: Optional[Dict[str, Any]] = None):
        message = f"Storage capacity exceeded during '{operation}': {current_usage} / {capacity_limit}"
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "operation": operation,
                "capacity_limit": capacity_limit,
                "current_usage": current_usage
            }
        )
        self.error_code = "STORAGE_CAPACITY_EXCEEDED"
        self.status_code = 507


class DataIntegrityError(StorageException):
    """Exception raised when data integrity checks fail."""
    
    def __init__(self, data_type: str, integrity_issue: str, affected_records: int = 0, details: Optional[Dict[str, Any]] = None):
        message = f"Data integrity error for {data_type}: {integrity_issue}"
        if affected_records > 0:
            message += f" (affects {affected_records} records)"
        
        super().__init__(
            message=message,
            details={
                **(details or {}),
                "data_type": data_type,
                "integrity_issue": integrity_issue,
                "affected_records": affected_records
            }
        )
        self.error_code = "DATA_INTEGRITY_ERROR"


# ===== VALIDATION EXCEPTIONS =====

class ValidationError(AuraException):
    """Exception raised for data validation errors."""
    
    def __init__(self, field_name: str, validation_issue: str, provided_value: Any = None, details: Optional[Dict[str, Any]] = None):
        message = f"Validation error for '{field_name}': {validation_issue}"
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            status_code=400,
            details={
                **(details or {}),
                "field_name": field_name,
                "validation_issue": validation_issue,
                "provided_value": str(provided_value) if provided_value is not None else None
            }
        )


class ConfigurationError(AuraException):
    """Exception raised for configuration-related errors."""
    
    def __init__(self, config_key: str, config_issue: str, details: Optional[Dict[str, Any]] = None):
        message = f"Configuration error for '{config_key}': {config_issue}"
        super().__init__(
            message=message,
            error_code="CONFIGURATION_ERROR",
            status_code=500,
            details={
                **(details or {}),
                "config_key": config_key,
                "config_issue": config_issue
            }
        )


# ===== BUSINESS LOGIC EXCEPTIONS =====

class FeedbackGenerationError(AuraException):
    """Exception raised when feedback generation fails."""
    
    def __init__(self, feedback_type: str, generation_issue: str, session_id: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        message = f"Feedback generation error for '{feedback_type}': {generation_issue}"
        super().__init__(
            message=message,
            error_code="FEEDBACK_GENERATION_ERROR",
            status_code=500,
            details={
                **(details or {}),
                "feedback_type": feedback_type,
                "generation_issue": generation_issue,
                "session_id": session_id
            }
        )


class AnalyticsError(AuraException):
    """Exception raised when analytics calculation fails."""
    
    def __init__(self, analytics_type: str, calculation_error: str, data_issues: Optional[list] = None, details: Optional[Dict[str, Any]] = None):
        message = f"Analytics error for '{analytics_type}': {calculation_error}"
        super().__init__(
            message=message,
            error_code="ANALYTICS_ERROR",
            status_code=500,
            details={
                **(details or {}),
                "analytics_type": analytics_type,
                "calculation_error": calculation_error,
                "data_issues": data_issues or []
            }
        )


# ===== SYSTEM EXCEPTIONS =====

class SystemResourceError(AuraException):
    """Exception raised when system resources are insufficient."""
    
    def __init__(self, resource_type: str, resource_limit: str, current_usage: str, details: Optional[Dict[str, Any]] = None):
        message = f"System resource limit exceeded for {resource_type}: {current_usage} / {resource_limit}"
        super().__init__(
            message=message,
            error_code="SYSTEM_RESOURCE_ERROR",
            status_code=507,
            details={
                **(details or {}),
                "resource_type": resource_type,
                "resource_limit": resource_limit,
                "current_usage": current_usage
            }
        )


class ServiceUnavailableError(AuraException):
    """Exception raised when a required service is unavailable."""
    
    def __init__(self, service_name: str, unavailable_reason: str, estimated_recovery: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        message = f"Service '{service_name}' unavailable: {unavailable_reason}"
        if estimated_recovery:
            message += f" (estimated recovery: {estimated_recovery})"
        
        super().__init__(
            message=message,
            error_code="SERVICE_UNAVAILABLE",
            status_code=503,
            details={
                **(details or {}),
                "service_name": service_name,
                "unavailable_reason": unavailable_reason,
                "estimated_recovery": estimated_recovery
            }
        )


class RateLimitExceededError(AuraException):
    """Exception raised when rate limits are exceeded."""
    
    def __init__(self, resource: str, limit: int, window_seconds: int, reset_time: Optional[datetime] = None, details: Optional[Dict[str, Any]] = None):
        message = f"Rate limit exceeded for {resource}: {limit} requests per {window_seconds}s"
        if reset_time:
            message += f", resets at {reset_time.isoformat()}"
        
        super().__init__(
            message=message,
            error_code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            details={
                **(details or {}),
                "resource": resource,
                "limit": limit,
                "window_seconds": window_seconds,
                "reset_time": reset_time.isoformat() if reset_time else None
            }
        )


# ===== EXCEPTION UTILITIES =====

def create_error_response(exception: AuraException) -> Dict[str, Any]:
    """
    Create standardized error response from AURA exception.
    
    Args:
        exception: AURA exception instance
        
    Returns:
        Dict containing structured error response
    """
    return {
        "error": True,
        "error_code": exception.error_code,
        "message": exception.message,
        "status_code": exception.status_code,
        "details": exception.details,
        "timestamp": exception.timestamp.isoformat(),
        "type": exception.__class__.__name__
    }


def handle_pipeline_error(error: Exception, processor_name: str, context: Dict[str, Any]) -> ProcessorException:
    """
    Convert generic exception to pipeline-specific exception.
    
    Args:
        error: Original exception
        processor_name: Name of the processor where error occurred
        context: Additional context information
        
    Returns:
        ProcessorException with enriched context
    """
    return ProcessorException(
        processor_name=processor_name,
        error_message=str(error),
        details={
            "original_error_type": type(error).__name__,
            "context": context,
            "traceback_available": True
        }
    )


def is_retryable_error(exception: AuraException) -> bool:
    """
    Determine if an exception represents a retryable error.
    
    Args:
        exception: AURA exception to check
        
    Returns:
        True if error is retryable, False otherwise
    """
    retryable_codes = {
        "AI_MODEL_TIMEOUT",
        "PIPELINE_TIMEOUT", 
        "WEBSOCKET_CONNECTION_ERROR",
        "STORAGE_CONNECTION_ERROR",
        "SERVICE_UNAVAILABLE",
        "SYSTEM_RESOURCE_ERROR"
    }
    
    return exception.error_code in retryable_codes


def get_recovery_suggestions(exception: AuraException) -> List[str]:
    """
    Get recovery suggestions for specific exception types.
    
    Args:
        exception: AURA exception
        
    Returns:
        List of recovery suggestions
    """
    suggestions = {
        "AUDIO_QUALITY_INSUFFICIENT": [
            "Use a higher quality microphone",
            "Reduce background noise",
            "Speak closer to the microphone",
            "Check audio input levels"
        ],
        "AI_MODEL_QUOTA_EXCEEDED": [
            "Wait for quota reset",
            "Use a different AI model",
            "Reduce request frequency",
            "Contact support for quota increase"
        ],
        "PIPELINE_TIMEOUT": [
            "Reduce audio chunk size",
            "Check network connectivity",
            "Retry with simpler processing options",
            "Contact support if issue persists"
        ],
        "STORAGE_CAPACITY_EXCEEDED": [
            "Delete old sessions",
            "Archive completed sessions",
            "Upgrade storage plan",
            "Contact administrator"
        ]
    }
    
    return suggestions.get(exception.error_code, [
        "Retry the operation",
        "Check system status",
        "Contact support if issue persists"
    ]) 