"""
AURA Logging Configuration

Structured logging setup with JSON formatting, performance tracking,
and integration with monitoring systems.
"""

import logging
import logging.config
import json
import sys
from datetime import datetime
from typing import Dict, Any, Optional
import structlog
from pathlib import Path

from app.config import get_settings

settings = get_settings()


class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging."""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields from record
        for key, value in record.__dict__.items():
            if key not in {
                'name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
                'filename', 'module', 'lineno', 'funcName', 'created',
                'msecs', 'relativeCreated', 'thread', 'threadName',
                'processName', 'process', 'getMessage', 'exc_info',
                'exc_text', 'stack_info'
            }:
                log_entry[key] = value
        
        return json.dumps(log_entry, ensure_ascii=False)


class TextFormatter(logging.Formatter):
    """Human-readable text formatter for development."""
    
    def __init__(self):
        super().__init__(
            fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )


def setup_logging() -> None:
    """Setup logging configuration based on settings."""
    
    # Create logs directory if it doesn't exist
    log_file_path = Path(settings.log_file_path)
    log_file_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Choose formatter based on settings
    if settings.log_format.lower() == "json":
        formatter = JSONFormatter()
    else:
        formatter = TextFormatter()
    
    # Configure logging
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": JSONFormatter,
            },
            "text": {
                "()": TextFormatter,
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "stream": sys.stdout,
                "formatter": settings.log_format.lower(),
                "level": settings.log_level,
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "filename": str(log_file_path),
                "maxBytes": 10 * 1024 * 1024,  # 10MB
                "backupCount": 5,
                "formatter": settings.log_format.lower(),
                "level": settings.log_level,
            }
        },
        "loggers": {
            "aura": {
                "level": settings.log_level,
                "handlers": ["console", "file"],
                "propagate": False,
            },
            "genai_processors": {
                "level": "INFO",
                "handlers": ["console", "file"],
                "propagate": False,
            },
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            },
            "fastapi": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            }
        },
        "root": {
            "level": settings.log_level,
            "handlers": ["console"],
        }
    }
    
    logging.config.dictConfig(logging_config)
    
    # Configure structlog if using JSON format
    if settings.log_format.lower() == "json":
        structlog.configure(
            processors=[
                structlog.stdlib.filter_by_level,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                structlog.stdlib.PositionalArgumentsFormatter(),
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.UnicodeDecoder(),
                structlog.processors.JSONRenderer()
            ],
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            wrapper_class=structlog.stdlib.BoundLogger,
            cache_logger_on_first_use=True,
        )


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with AURA-specific configuration.
    
    Args:
        name: Logger name, typically __name__ of the calling module
        
    Returns:
        Configured logger instance
    """
    if name.startswith("backend."):
        # Map backend module names to aura logger
        logger_name = f"aura.{name[8:]}"  # Remove 'backend.' prefix
    else:
        logger_name = f"aura.{name}"
    
    return logging.getLogger(logger_name)


class PerformanceLogger:
    """Context manager for logging performance metrics."""
    
    def __init__(self, logger: logging.Logger, operation: str, **context):
        """
        Initialize performance logger.
        
        Args:
            logger: Logger instance to use
            operation: Name of the operation being measured
            **context: Additional context to include in logs
        """
        self.logger = logger
        self.operation = operation
        self.context = context
        self.start_time = None
    
    def __enter__(self):
        """Start timing."""
        self.start_time = datetime.utcnow()
        self.logger.info(
            f"Starting {self.operation}",
            extra={
                "operation": self.operation,
                "start_time": self.start_time.isoformat(),
                **self.context
            }
        )
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """End timing and log results."""
        end_time = datetime.utcnow()
        duration_ms = (end_time - self.start_time).total_seconds() * 1000
        
        log_data = {
            "operation": self.operation,
            "start_time": self.start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_ms": duration_ms,
            **self.context
        }
        
        if exc_type is None:
            self.logger.info(
                f"Completed {self.operation} in {duration_ms:.2f}ms",
                extra=log_data
            )
        else:
            log_data["error"] = str(exc_val)
            log_data["error_type"] = exc_type.__name__
            self.logger.error(
                f"Failed {self.operation} after {duration_ms:.2f}ms",
                extra=log_data,
                exc_info=True
            )


class SessionLogger:
    """Logger wrapper that automatically includes session context."""
    
    def __init__(self, logger: logging.Logger, session_id: str, **context):
        """
        Initialize session logger.
        
        Args:
            logger: Base logger instance
            session_id: Session identifier
            **context: Additional context to include in all logs
        """
        self.logger = logger
        self.session_context = {
            "session_id": session_id,
            **context
        }
    
    def _log(self, level: str, message: str, **extra):
        """Log message with session context."""
        log_method = getattr(self.logger, level)
        log_method(
            message,
            extra={
                **self.session_context,
                **extra
            }
        )
    
    def debug(self, message: str, **extra):
        """Log debug message."""
        self._log("debug", message, **extra)
    
    def info(self, message: str, **extra):
        """Log info message."""
        self._log("info", message, **extra)
    
    def warning(self, message: str, **extra):
        """Log warning message."""
        self._log("warning", message, **extra)
    
    def error(self, message: str, **extra):
        """Log error message."""
        self._log("error", message, **extra)
    
    def critical(self, message: str, **extra):
        """Log critical message."""
        self._log("critical", message, **extra)
    
    def performance(self, operation: str, **context) -> PerformanceLogger:
        """Create performance logger with session context."""
        return PerformanceLogger(
            self.logger,
            operation,
            **self.session_context,
            **context
        )


class MetricsLogger:
    """Logger for application metrics and monitoring."""
    
    def __init__(self, logger: logging.Logger):
        """Initialize metrics logger."""
        self.logger = logger
    
    def log_audio_processing_metrics(self,
                                   session_id: str,
                                   chunk_size: int,
                                   processing_time_ms: float,
                                   **metrics):
        """Log audio processing metrics."""
        self.logger.info(
            "Audio processing metrics",
            extra={
                "metric_type": "audio_processing",
                "session_id": session_id,
                "chunk_size": chunk_size,
                "processing_time_ms": processing_time_ms,
                **metrics
            }
        )
    
    def log_feedback_generation_metrics(self,
                                       session_id: str,
                                       feedback_count: int,
                                       generation_time_ms: float,
                                       model_version: str):
        """Log feedback generation metrics."""
        self.logger.info(
            "Feedback generation metrics",
            extra={
                "metric_type": "feedback_generation",
                "session_id": session_id,
                "feedback_count": feedback_count,
                "generation_time_ms": generation_time_ms,
                "model_version": model_version
            }
        )
    
    def log_session_metrics(self,
                           session_id: str,
                           duration_seconds: float,
                           total_chunks_processed: int,
                           average_processing_time_ms: float,
                           **session_data):
        """Log session completion metrics."""
        self.logger.info(
            "Session completion metrics",
            extra={
                "metric_type": "session_completion",
                "session_id": session_id,
                "duration_seconds": duration_seconds,
                "total_chunks_processed": total_chunks_processed,
                "average_processing_time_ms": average_processing_time_ms,
                **session_data
            }
        )
    
    def log_error_metrics(self,
                         error_type: str,
                         error_message: str,
                         session_id: Optional[str] = None,
                         **context):
        """Log error occurrence for monitoring."""
        self.logger.error(
            "Error occurrence",
            extra={
                "metric_type": "error_occurrence",
                "error_type": error_type,
                "error_message": error_message,
                "session_id": session_id,
                **context
            }
        )
    
    def log_system_metrics(self,
                          active_sessions: int,
                          cpu_usage: float,
                          memory_usage: float,
                          **system_data):
        """Log system performance metrics."""
        self.logger.info(
            "System performance metrics",
            extra={
                "metric_type": "system_performance",
                "active_sessions": active_sessions,
                "cpu_usage_percent": cpu_usage,
                "memory_usage_percent": memory_usage,
                **system_data
            }
        )


def get_main_logger() -> logging.Logger:
    """Get the main application logger."""
    return get_logger("main")


def get_metrics_logger() -> MetricsLogger:
    """Get the metrics logger instance."""
    base_logger = get_logger("metrics")
    return MetricsLogger(base_logger)


def create_session_logger(session_id: str, **context) -> SessionLogger:
    """
    Create a session-specific logger.
    
    Args:
        session_id: Session identifier
        **context: Additional context for all logs
        
    Returns:
        SessionLogger instance
    """
    base_logger = get_logger("session")
    return SessionLogger(base_logger, session_id, **context)


# Initialize logging on import
setup_logging() 