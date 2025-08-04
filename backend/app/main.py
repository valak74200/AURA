"""
AURA - AI-Powered Presentation Coach

Main FastAPI application entry point with middleware, exception handlers,
and API route integration.
"""

import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict

# Load environment variables early so uvicorn picks up ELEVENLABS_API_KEY and others
try:
    from dotenv import load_dotenv  # type: ignore
    # Prefer backend/.env then repo root .env; do not override already-set env vars
    backend_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    project_env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    load_dotenv(backend_env_path, override=False)
    load_dotenv(project_env_path, override=False)
except Exception:
    # dotenv is optional in production; ignore if not available
    pass

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.database import create_tables, check_database_connection
from models.feedback import ErrorResponse
from utils.exceptions import AuraException
from utils.logging import get_logger, setup_logging
from utils.json_encoder import serialize_response_data

settings = get_settings()
logger = get_logger(__name__)

# Global services storage
services = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info(
        "Starting AURA application", 
        extra={
            "environment": settings.environment,
            "debug": settings.debug,
            "log_level": settings.log_level
        }
    )
    
    # Initialize services
    await initialize_services()
    
    yield
    
    # Cleanup
    logger.info("Shutting down AURA application")
    await cleanup_services()


async def initialize_services():
    """Initialize all application services with dependency injection."""
    try:
        # Setup logging
        setup_logging()
        
        # Initialize database
        logger.info("Initializing database...")
        db_connected = await check_database_connection()
        if db_connected:
            await create_tables()
            logger.info("Database initialized successfully")
        else:
            logger.warning("Database connection failed - some features may not work")
        
        # Initialize service registry with dependency injection
        from services.service_registry import get_service_registry
        from services.service_interfaces import (
            IAudioService, IGeminiService, IStorageService,
            IAuthService, ICacheService, IHealthCheckService
        )
        
        service_registry = await get_service_registry()
        container = service_registry.container
        
        # Get services through dependency injection
        services['storage'] = await container.get_service(IStorageService)
        services['audio'] = await container.get_service(IAudioService)
        services['gemini'] = await container.get_service(IGeminiService)
        services['auth'] = await container.get_service(IAuthService)
        services['cache'] = await container.get_service(ICacheService)
        services['health'] = await container.get_service(IHealthCheckService)
        
        # Initialize all services
        for service_name, service in services.items():
            if hasattr(service, 'initialize'):
                await service.initialize()
                logger.info(f"Initialized {service_name} service")
        
        logger.info("All services initialized successfully with dependency injection")
        
        # Create and include routers with initialized services
        api_router = create_router(services)
        websocket_router = create_websocket_router(services)
        
        app.include_router(api_router, prefix="/api/v1", tags=["API"])
        app.include_router(websocket_router, prefix="/ws", tags=["WebSocket"])
        app.include_router(auth_router, prefix="/api/v1", tags=["Authentication"])
        app.include_router(user_router, prefix="/api/v1/user", tags=["User"])
        logger.info("API routers initialized with dependency-injected services")
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise


async def cleanup_services():
    """Cleanup application services with proper dependency injection cleanup."""
    try:
        # Cleanup all services that have cleanup methods
        for service_name, service in services.items():
            if hasattr(service, 'cleanup'):
                try:
                    await service.cleanup()
                    logger.info(f"Cleaned up {service_name} service")
                except Exception as e:
                    logger.error(f"Error cleaning up {service_name} service: {e}")
        
        services.clear()
        logger.info("Services cleanup completed")
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")


# Create FastAPI application
app = FastAPI(
    title="AURA - AI Presentation Coach",
    description="AI-powered presentation coaching platform with real-time feedback",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # Use configured CORS origins for security
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],
)


# Request ID middleware for correlation and logging
class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Obtain or generate a request id
        request_id = request.headers.get("x-request-id")
        if not request_id:
            import uuid
            request_id = str(uuid.uuid4())

        # Attach to request state for downstream use
        request.state.request_id = request_id

        # Process request
        response = await call_next(request)

        # Ensure header is set on response
        try:
            response.headers["X-Request-ID"] = request_id
        except Exception:
            # In case response doesn't support headers mapping (edge cases)
            pass

        return response

# Request logging middleware
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = datetime.utcnow()

        # Process request
        response = await call_next(request)

        # Log request with correlation id
        process_time = (datetime.utcnow() - start_time).total_seconds()
        request_id = getattr(request.state, "request_id", request.headers.get("x-request-id", "unknown"))
        logger.info(
            "Request processed",
            extra={
                "method": request.method,
                "url": str(request.url),
                "status_code": response.status_code,
                "process_time": process_time,
                "request_id": request_id,
            }
        )

        # Make sure response also has the header (idempotent)
        try:
            if "X-Request-ID" not in response.headers:
                response.headers["X-Request-ID"] = str(request_id)
        except Exception:
            pass

        return response


# Order: set RequestID first so later middlewares can use it
app.add_middleware(RequestIDMiddleware)
app.add_middleware(RequestLoggingMiddleware)


# Exception handlers
@app.exception_handler(AuraException)
async def aura_exception_handler(request: Request, exc: AuraException):
    """Handle AURA custom exceptions."""
    logger.error(
        f"AURA Exception: {exc.message}",
        extra={
            "error_code": exc.error_code,
            "details": exc.details,
            "url": str(request.url)
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.error_code,
            message=exc.message,
            details=exc.details,
            timestamp=datetime.utcnow(),
            request_id=str(request.headers.get("x-request-id", "unknown"))
        ).dict()
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    logger.warning(
        f"HTTP Exception: {exc.detail}",
        extra={
            "status_code": exc.status_code,
            "url": str(request.url)
        }
    )
    
    error_data = {
        "error": "HTTP_ERROR",
        "message": exc.detail,
        "timestamp": datetime.utcnow().isoformat()
    }
    return JSONResponse(
        status_code=exc.status_code,
        content=serialize_response_data(error_data)
    )


@app.exception_handler(500)
async def internal_server_error_handler(request: Request, exc: Exception):
    """Handle internal server errors."""
    logger.error(
        f"Internal Server Error: {str(exc)}",
        extra={
            "url": str(request.url),
            "exception_type": type(exc).__name__
        }
    )
    
    internal_error_data = {
        "error": "INTERNAL_SERVER_ERROR",
        "message": "Une erreur interne s'est produite",
        "timestamp": datetime.utcnow().isoformat()
    }
    return JSONResponse(
        status_code=500,
        content=serialize_response_data(internal_error_data)
    )


# Include API routes
from app.api.routes import create_router
from app.api.websocket import create_websocket_router
from app.api.auth import router as auth_router
from app.api.user import router as user_router

# Les routers sont créés et attachés dans initialize_services()


# Basic endpoints
@app.get("/")
async def root():
    """Root endpoint."""
    root_data = {
        "message": "AURA - AI Presentation Coach",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": {
            "api": "/api/v1",
            "websocket": "/ws",
            "docs": "/docs",
            "health": "/health"
        }
    }
    return serialize_response_data(root_data)


@app.get("/health")
async def health_check(request: Request):
    """Minimal health endpoint (uptime, version)."""
    minimal = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": app.version,
        "uptime_hint": "See /api/v1/health for detailed service status"
    }
    # Ensure we return a dict/list (no double-serialization risk)
    return serialize_response_data(minimal)


@app.get("/info")
async def app_info():
    """Application information."""
    info_data = {
        "name": "AURA",
        "description": "AI-powered presentation coach",
        "version": "1.0.0",
        "environment": settings.environment,
        "gemini_model": settings.default_gemini_model,
        "features": [
            "Real-time voice analysis",
            "AI-powered feedback", 
            "Performance metrics",
            "WebSocket streaming",
            "Session management",
            "Analytics dashboard"
        ]
    }
    return serialize_response_data(info_data)


@app.get("/debug/cors")
async def debug_cors():
    """Debug CORS configuration."""
    debug_data = {
        "cors_origins": settings.cors_origins,
        "environment": settings.environment,
        "debug": settings.debug,
        "timestamp": datetime.utcnow().isoformat()
    }
    return serialize_response_data(debug_data)


# Test Gemini endpoint
@app.post("/test/gemini")
async def test_gemini(message: str = "Bonjour AURA"):
    """Test Gemini API connection."""
    try:
        if 'gemini' not in services:
            raise HTTPException(status_code=503, detail="Service Gemini non disponible")
            
        gemini_service = services['gemini']
        
        # Simple test call
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.default_gemini_model)
        
        response = model.generate_content(f"Tu es AURA, un coach de présentation. Réponds à ce message: {message}")
        
        gemini_response = {
            "status": "success",
            "model": settings.default_gemini_model,
            "message": message,
            "response": response.text,
            "timestamp": datetime.utcnow().isoformat()
        }
        return serialize_response_data(gemini_response)
        
    except Exception as e:
        logger.error(f"Gemini test failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur Gemini: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    ) 