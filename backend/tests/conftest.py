"""
Configuration globale pour les tests AURA - Tests d'intégration réels.

Fixtures pour tests d'intégration avec vraies bases de données et services.
"""

import pytest
import pytest_asyncio
import asyncio
import tempfile
import os
import wave
import struct
import math
from typing import AsyncGenerator, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from httpx import AsyncClient

# Early dotenv load with forced override for ELEVENLABS_API_KEY if missing/empty
try:
    from dotenv import load_dotenv, find_dotenv
    from pathlib import Path

    def _empty(val: str | None) -> bool:
        return val is None or val == "" or val.strip() == ""

    # 1) Soft-load .env files
    _dotenv_path = find_dotenv(filename=".env", usecwd=True)
    if _dotenv_path:
        load_dotenv(dotenv_path=_dotenv_path, override=False)
    else:
        repo_root = Path(__file__).resolve().parents[2]
        backend_env = repo_root / "backend" / ".env"
        if backend_env.exists():
            load_dotenv(dotenv_path=str(backend_env), override=False)

    # 2) Force override ELEVENLABS_API_KEY only if currently missing or empty
    if _empty(os.getenv("ELEVENLABS_API_KEY")):
        # Prefer backend/.env
        repo_root = Path(__file__).resolve().parents[2]
        backend_env = repo_root / "backend" / ".env"
        if backend_env.exists():
            load_dotenv(dotenv_path=str(backend_env), override=True)
        elif _dotenv_path:
            load_dotenv(dotenv_path=_dotenv_path, override=True)
except Exception:
    # Do not fail tests due to dotenv issues
    pass

# Load environment variables from .env so pydantic Settings() finds required keys during tests
try:
    from dotenv import load_dotenv, find_dotenv
    # Try to find .env starting from current working directory (repo root when running pytest)
    _dotenv_path = find_dotenv(filename=".env", usecwd=True)
    if _dotenv_path:
        load_dotenv(dotenv_path=_dotenv_path, override=False)
    else:
        # Fallback: explicitly try backend/.env
        from pathlib import Path
        repo_root = Path(__file__).resolve().parents[2]
        backend_env = repo_root / "backend" / ".env"
        if backend_env.exists():
            load_dotenv(dotenv_path=str(backend_env), override=False)
except Exception:
    # If dotenv loading fails, environment may already be set outside pytest
    pass

from app.database import Base, get_database
from app.main import app
from app.config import get_settings
from models.session import PresentationSessionData, SessionConfig, SupportedLanguage
from services.service_registry import ServiceRegistry
from utils.logging import get_logger

# Ensure ELEVENLABS_API_KEY (and other keys) are loaded from backend/.env for pytest runs
# Force-inject ELEVENLABS_API_KEY with override=True if not already defined.
try:
    from dotenv import load_dotenv, find_dotenv
    from pathlib import Path
    # Try CWD .env first (repo root)
    _dotenv_path = find_dotenv(filename=".env", usecwd=True)
    loaded = False
    if _dotenv_path:
        load_dotenv(dotenv_path=_dotenv_path, override=False)
        loaded = True
    # Fallback to backend/.env
    if not loaded:
        repo_root = Path(__file__).resolve().parents[2]
        backend_env = repo_root / "backend" / ".env"
        if backend_env.exists():
            load_dotenv(dotenv_path=str(backend_env), override=False)
            loaded = True

    # If ELEVENLABS_API_KEY not present after soft load, force override from .env if available
    if not os.getenv("ELEVENLABS_API_KEY"):
        # Prefer backend/.env explicitly when forcing override
        repo_root = Path(__file__).resolve().parents[2]
        backend_env = repo_root / "backend" / ".env"
        if backend_env.exists():
            load_dotenv(dotenv_path=str(backend_env), override=True)
        elif _dotenv_path:
            load_dotenv(dotenv_path=_dotenv_path, override=True)
except Exception:
    # If anything goes wrong, we keep going; tests that require external key will skip/fail explicitly
    pass

logger = get_logger(__name__)

# Configuration pour tests d'intégration
# Utilise SQLite en mémoire par défaut pour les tests, plus fiable que PostgreSQL
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", 
    "sqlite+aiosqlite:///./test_aura.db"
)

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="session")
async def test_db_engine():
    """Create test database engine for integration tests."""
    # Utiliser SQLite pour les tests pour éviter les problèmes de connexion PostgreSQL
    if "sqlite" in TEST_DATABASE_URL:
        engine = create_async_engine(
            TEST_DATABASE_URL,
            echo=False,
            poolclass=StaticPool,
            connect_args={
                "check_same_thread": False,
            }
        )
    else:
        # Si PostgreSQL est spécifiquement configuré
        engine = create_async_engine(
            TEST_DATABASE_URL,
            echo=False,
            pool_pre_ping=True
        )
    
    try:
        # Create all tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        yield engine
        
    except Exception as e:
        logger.warning(f"Database setup failed: {e}. Some tests may fail.")
        yield engine
    finally:
        # Cleanup after all tests
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
        except:
            pass
        
        await engine.dispose()

@pytest_asyncio.fixture
async def test_db_session(test_db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    async_session_maker = async_sessionmaker(
        test_db_engine, 
        class_=AsyncSession, 
        expire_on_commit=False
    )
    
    async with async_session_maker() as session:
        try:
            # Start transaction for test isolation
            transaction = await session.begin()
            yield session
        except Exception as e:
            logger.warning(f"Database session error: {e}")
            yield session
        finally:
            try:
                # Rollback transaction to keep tests isolated
                if session.in_transaction():
                    await session.rollback()
            except:
                pass

@pytest_asyncio.fixture
async def test_app(test_db_session):
    """Create test FastAPI app with real database and initialized services."""
    from app.main import initialize_services, cleanup_services, services
    from app.api.routes import create_router
    from app.api.websocket import create_websocket_router
    from app.api.auth import router as auth_router
    from app.api.user import router as user_router
    
    # Override database dependency
    async def override_get_database():
        yield test_db_session
    
    app.dependency_overrides[get_database] = override_get_database
    
    # Initialize services like in the real application
    try:
        await initialize_services()
        
        # Create and include routers with initialized services
        api_router = create_router(services)
        websocket_router = create_websocket_router(services)
        
        # Clear existing routes to avoid duplicates
        app.routes.clear()
        
        # Add the basic routes back
        from app.main import root, health_check, app_info, debug_cors, test_gemini
        app.get("/")(root)
        app.get("/health")(health_check)
        app.get("/info")(app_info)
        app.get("/debug/cors")(debug_cors)
        app.post("/test/gemini")(test_gemini)
        
        # Include API routers
        app.include_router(api_router, prefix="/api/v1", tags=["API"])
        app.include_router(websocket_router, prefix="/ws", tags=["WebSocket"])
        app.include_router(auth_router, prefix="/api/v1", tags=["Authentication"])
        app.include_router(user_router, prefix="/api/v1/user", tags=["User"])
        
        logger.info("Test app initialized with all services and routes")
        
    except Exception as e:
        logger.error(f"Failed to initialize test app services: {e}")
        # Continue with basic app if services fail
    
    yield app
    
    # Cleanup
    app.dependency_overrides.clear()
    try:
        await cleanup_services()
    except:
        pass


@pytest_asyncio.fixture
async def test_client(test_app) -> AsyncGenerator[AsyncClient, None]:
    """Create async test client."""
    from httpx import ASGITransport
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

@pytest.fixture
def sync_test_client(test_app) -> TestClient:
    """Create synchronous test client for WebSocket tests."""
    return TestClient(test_app)

@pytest.fixture
def sample_session_config() -> SessionConfig:
    """Create sample session configuration."""
    return SessionConfig(
        language=SupportedLanguage.FRENCH,
        duration_minutes=30,
        real_time_feedback=True,
        ai_coaching=True,
        difficulty_level="intermediate",
        presentation_type="business"
    )

@pytest.fixture
def sample_session_data(sample_session_config) -> PresentationSessionData:
    """Create sample session data."""
    return PresentationSessionData(
        title="Test Presentation",
        description="A test presentation for integration tests",
        config=sample_session_config,
        presenter_name="Test User"
    )

@pytest.fixture
def real_audio_file() -> bytes:
    """Generate real WAV audio file for testing."""
    # Créer un fichier WAV réaliste avec des données audio synthétiques
    sample_rate = 16000
    duration = 1.0  # 1 seconde
    frequency = 440  # La note (440 Hz)
    
    # Générer une onde sinusoïdale
    samples = []
    for i in range(int(sample_rate * duration)):
        time = i / sample_rate
        amplitude = 32767 * 0.3  # 30% du volume max pour éviter la saturation
        sample = int(amplitude * math.sin(2 * math.pi * frequency * time))
        samples.append(sample)
    
    # Créer le fichier WAV en mémoire
    with tempfile.NamedTemporaryFile() as temp_file:
        with wave.open(temp_file.name, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16 bits
            wav_file.setframerate(sample_rate)
            
            # Écrire les échantillons
            for sample in samples:
                wav_file.writeframes(struct.pack('<h', sample))
        
        # Lire le contenu du fichier
        with open(temp_file.name, 'rb') as f:
            return f.read()

@pytest.fixture 
def authenticated_headers() -> Dict[str, str]:
    """Create headers with authentication token for API tests."""
    # Dans un vrai test, on devrait créer un utilisateur et obtenir un token réel
    # Pour les tests d'intégration, on utilise un token de test
    test_token = "test-jwt-token-for-integration-tests"
    return {
        "Authorization": f"Bearer {test_token}",
        "Content-Type": "application/json"
    }

@pytest.fixture
def mock_user_data() -> Dict[str, Any]:
    """Create mock user data for tests."""
    return {
        "email": "test@example.com",
        "name": "Test User",
        "password": "test_password_123",
        "preferences": {
            "language": "fr",
            "notifications": True
        }
    }

@pytest.fixture
def test_user_data() -> Dict[str, Any]:
    """Create test user data for authentication tests."""
    return {
        "username": "integration_test_user",
        "email": "integration@test.com",
        "password": "TestPassword123!",
        "confirm_password": "TestPassword123!"
    }

@pytest.fixture
def silence_audio_file() -> bytes:
    """Generate silence audio file for testing."""
    sample_rate = 16000
    duration = 1.0  # 1 seconde de silence
    
    # Créer un fichier WAV avec du silence (valeurs à zéro)
    samples = [0] * int(sample_rate * duration)
    
    with tempfile.NamedTemporaryFile() as temp_file:
        with wave.open(temp_file.name, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16 bits
            wav_file.setframerate(sample_rate)
            
            # Écrire les échantillons de silence
            for sample in samples:
                wav_file.writeframes(struct.pack('<h', sample))
        
        # Lire le contenu du fichier
        with open(temp_file.name, 'rb') as f:
            return f.read()

@pytest.fixture
def large_audio_file() -> bytes:
    """Generate larger audio file for streaming tests."""
    sample_rate = 16000
    duration = 5.0  # 5 secondes
    frequency = 440
    
    samples = []
    for i in range(int(sample_rate * duration)):
        time = i / sample_rate
        amplitude = 32767 * 0.3
        # Variation de fréquence pour rendre l'audio plus réaliste
        varying_freq = frequency + 50 * math.sin(2 * math.pi * 0.5 * time)
        sample = int(amplitude * math.sin(2 * math.pi * varying_freq * time))
        samples.append(sample)
    
    with tempfile.NamedTemporaryFile() as temp_file:
        with wave.open(temp_file.name, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            
            for sample in samples:
                wav_file.writeframes(struct.pack('<h', sample))
        
        with open(temp_file.name, 'rb') as f:
            return f.read()

# Hook pour personnaliser les marqueurs de test
def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "unit: mark test as unit test")
    config.addinivalue_line("markers", "e2e: mark test as end-to-end test")
    config.addinivalue_line("markers", "slow: mark test as slow running")
    config.addinivalue_line("markers", "real_services: mark test as requiring real external services")
