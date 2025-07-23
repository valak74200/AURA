"""
AURA Application Configuration

This module contains all configuration settings for the AURA application
using Pydantic Settings for environment variable management.
"""

import os
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )
    
    # API Keys
    gemini_api_key: str = Field(..., description="Gemini API key for AI processing")
    google_cloud_project: str = Field(..., description="Google Cloud Project ID")
    
    # Database Settings
    database_url: str = Field(default="sqlite+aiosqlite:///./aura.db", description="Database connection URL")
    db_echo: bool = Field(default=False, description="Enable database query logging")
    
    # Authentication Settings
    secret_key: str = Field(..., description="Secret key for JWT tokens")
    access_token_expire_minutes: int = Field(default=30, description="JWT token expiration in minutes")
    
    # Application Settings
    debug: bool = Field(default=False, description="Enable debug mode")
    log_level: str = Field(default="INFO", description="Logging level")
    max_session_duration: int = Field(default=1800, description="Max session duration in seconds")
    environment: str = Field(default="development", description="Application environment")
    
    # External Services
    redis_url: str = Field(default="redis://localhost:6379", description="Redis connection URL")
    
    # Performance Tuning
    max_concurrent_sessions: int = Field(default=100, description="Maximum concurrent sessions")
    audio_chunk_size: int = Field(default=1600, description="Audio chunk size for processing")
    audio_sample_rate: int = Field(default=16000, description="Audio sample rate in Hz")
    
    # Security Settings (moved from duplicate above)
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8080"],
        description="Allowed CORS origins"
    )
    
    # Logging
    log_format: str = Field(default="json", description="Log format (json or text)")
    log_file_path: str = Field(default="logs/aura.log", description="Log file path")
    
    # Monitoring
    metrics_enabled: bool = Field(default=True, description="Enable metrics collection")
    metrics_port: int = Field(default=9090, description="Metrics server port")
    
    # Audio Processing
    max_audio_file_size: int = Field(default=10485760, description="Max audio file size in bytes")
    supported_audio_formats: List[str] = Field(
        default=["wav", "mp3", "m4a", "ogg"],
        description="Supported audio file formats"
    )
    
    # AI Model Configuration
    default_gemini_model: str = Field(
        default="gemini-2.5-flash", 
        description="Default Gemini model for AURA"
    )
    gemini_thinking_model: str = Field(
        default="gemini-2.5-flash",  # Utiliser le même modèle pour l'instant
        description="Gemini model for complex analysis (thinking not yet available)"
    )
    gemini_pro_model: str = Field(
        default="gemini-2.5-pro",  # Garder Pro si disponible
        description="Most capable Gemini model for advanced analysis"
    )
    
    # Thinking Budget Configuration (pour quand ce sera disponible)
    default_thinking_budget: int = Field(
        default=1000,
        description="Default thinking tokens budget for reasoning tasks"
    )
    max_thinking_budget: int = Field(
        default=5000,
        description="Maximum thinking tokens budget for complex tasks"
    )
    
    # WebSocket Settings
    ws_heartbeat_interval: int = Field(default=30, description="WebSocket heartbeat interval in seconds")
    ws_max_connections: int = Field(default=1000, description="Maximum WebSocket connections")
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.environment.lower() == "development"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment.lower() == "production"


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get application settings instance."""
    return settings 