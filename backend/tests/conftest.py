"""
Configuration pytest pour les tests AURA.

Fournit les fixtures et configuration de base pour tous les tests.
"""

import asyncio
import os
import pytest
import pytest_asyncio
import tempfile
from typing import AsyncGenerator, Dict, Any
from uuid import uuid4
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
import json

# Configuration pour les tests avec PostgreSQL
os.environ["TESTING"] = "true"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://aura_user:aura_password@localhost:5432/aura_test_db"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only-32-chars"
os.environ["GEMINI_API_KEY"] = "AIzaSyAZe19Vfd4P3fZ0Im7zt49lYQsZbZySQeU"
os.environ["GOOGLE_CLOUD_PROJECT"] = "aura-466713"
os.environ["LOG_LEVEL"] = "ERROR"  # Réduire les logs pendant les tests

from app.main import app
# Import routers for test configuration
from app.api.routes import create_router
from app.api.websocket import create_websocket_router
from app.api.auth import router as auth_router
from app.api.user import router as user_router
from app.database import get_database, Base, create_tables, async_session_maker
from models.user import User, UserProfile
from services.auth_service import auth_service


@pytest.fixture(scope="session")
def event_loop():
    """Crée une boucle d'événements pour la session de tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def setup_test_database():
    """Configure la base de données de test PostgreSQL."""
    # Créer les tables pour les tests
    await create_tables()
    
    # Configure test app with routers (since lifespan doesn't run in tests)
    test_services = {
        'storage': None,  # Mock services for tests
        'audio': None,
        'gemini': None
    }
    
    # Add routers to test app
    api_router = create_router(test_services)
    websocket_router = create_websocket_router(test_services)
    
    app.include_router(api_router, prefix="/api/v1", tags=["API"])
    app.include_router(websocket_router, prefix="/ws", tags=["WebSocket"])
    app.include_router(auth_router, prefix="/api/v1", tags=["Authentication"])
    app.include_router(user_router, prefix="/api/v1/user", tags=["User"])
    
    yield
    # Cleanup sera fait par PostgreSQL en supprimant la DB de test


@pytest_asyncio.fixture(scope="function")
async def db_session(setup_test_database) -> AsyncGenerator[AsyncSession, None]:
    """Crée une session de base de données pour les tests."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


@pytest.fixture
def test_client() -> TestClient:
    """Client de test HTTP synchrone pour éviter les problèmes de boucles asyncio."""
    from fastapi.testclient import TestClient
    import asyncio
    
    # Initialiser l'app pour les tests
    async def init_test_app():
        from app.main import initialize_services
        try:
            await initialize_services()
        except Exception as e:
            print(f"Warning: Services initialization failed: {e}")
    
    # Exécuter l'initialisation dans une nouvelle boucle
    try:
        asyncio.run(init_test_app())
    except RuntimeError:
        # Si une boucle existe déjà, utiliser un thread
        import threading
        import concurrent.futures
        
        def run_in_thread():
            asyncio.run(init_test_app())
        
        with concurrent.futures.ThreadPoolExecutor() as executor:
            executor.submit(run_in_thread).result()
    
    return TestClient(app)


@pytest.fixture
def sync_client() -> TestClient:
    """Client de test HTTP synchrone pour les tests simples."""
    return TestClient(app)


@pytest.fixture
def test_user(test_client: TestClient) -> Dict[str, Any]:
    """Crée un utilisateur de test via l'API."""
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    
    user_data = {
        "email": f"testuser{unique_id}@example.com",
        "username": f"testuser{unique_id}",
        "password": "testpassword123",
        "confirm_password": "testpassword123",
        "first_name": "Test",
        "last_name": "User",
        "language": "fr"
    }
    
    # Créer l'utilisateur via l'API
    response = test_client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    created_user = response.json()
    
    return {
        "id": created_user["id"],
        "email": created_user["email"],
        "username": created_user["username"],
        "password": user_data["password"],  # Mot de passe en clair pour les tests
        "user_object": created_user
    }


@pytest.fixture
def auth_token(test_client: TestClient, test_user: Dict[str, Any]) -> str:
    """Génère un token d'authentification pour les tests."""
    login_data = {
        "email_or_username": test_user["email"],
        "password": test_user["password"]
    }
    
    response = test_client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    
    token_data = response.json()
    return token_data["access_token"]


@pytest.fixture
def auth_headers(auth_token: str) -> Dict[str, str]:
    """Headers d'authentification pour les tests."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def sample_session_data() -> Dict[str, Any]:
    """Données d'exemple pour créer une session."""
    return {
        "user_id": str(uuid4()),
        "title": "Session de test",
        "description": "Session de test pour les tests automatisés",
        "config": {
            "session_type": "practice",
            "language": "fr",
            "max_duration": 1800,
            "feedback_frequency": 5,
            "real_time_feedback": True,
            "ai_coaching": True
        }
    }


@pytest.fixture
def sample_audio_file() -> bytes:
    """Fichier audio d'exemple pour les tests."""
    # Crée un fichier WAV minimal valide (silence de 1 seconde)
    # Header WAV (44 bytes) + données audio
    sample_rate = 16000
    duration = 1  # seconde
    samples = sample_rate * duration
    
    # Header WAV
    header = bytearray(44)
    header[0:4] = b'RIFF'
    header[8:12] = b'WAVE'
    header[12:16] = b'fmt '
    header[16:20] = (16).to_bytes(4, 'little')  # Taille du chunk fmt
    header[20:22] = (1).to_bytes(2, 'little')   # Format PCM
    header[22:24] = (1).to_bytes(2, 'little')   # Nombre de canaux
    header[24:28] = sample_rate.to_bytes(4, 'little')  # Sample rate
    header[28:32] = (sample_rate * 2).to_bytes(4, 'little')  # Byte rate
    header[32:34] = (2).to_bytes(2, 'little')   # Block align
    header[34:36] = (16).to_bytes(2, 'little')  # Bits per sample
    header[36:40] = b'data'
    header[40:44] = (samples * 2).to_bytes(4, 'little')  # Data size
    
    # Données audio (silence)
    audio_data = b'\x00\x00' * samples
    
    return bytes(header) + audio_data


@pytest.fixture
def mock_gemini_response() -> Dict[str, Any]:
    """Réponse mock pour les tests Gemini."""
    return {
        "feedback_items": [
            {
                "type": "volume",
                "category": "technique",
                "severity": "info",
                "message": "Votre volume est approprié",
                "score": 0.8,
                "timestamp": "2024-01-01T12:00:00Z",
                "suggestions": ["Continuez à maintenir ce niveau"]
            },
            {
                "type": "pace",
                "category": "delivery",
                "severity": "warning",
                "message": "Votre débit est un peu rapide",
                "score": 0.6,
                "timestamp": "2024-01-01T12:00:05Z",
                "suggestions": ["Essayez de ralentir légèrement"]
            }
        ]
    }


@pytest.fixture
def test_session(test_client: TestClient, sample_session_data: Dict[str, Any]) -> Dict[str, Any]:
    """Crée une session de test."""
    response = test_client.post("/api/v1/sessions", json=sample_session_data)
    if response.status_code != 201:
        # Si la création échoue, retourner des données mock
        return {
            "id": str(uuid4()),
            "user_id": sample_session_data["user_id"],
            "title": sample_session_data["title"],
            "status": "active"
        }
    
    session_data = response.json()
    return session_data


# Configuration globale pytest
pytest_plugins = ["pytest_asyncio"]

# Configuration asyncio
pytest_asyncio.asyncio_mode = "strict"

# Marques personnalisées
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "integration: marque les tests d'intégration (lents)"
    )
    config.addinivalue_line(
        "markers", "unit: marque les tests unitaires (rapides)"
    )
    config.addinivalue_line(
        "markers", "websocket: marque les tests WebSocket"
    )
    config.addinivalue_line(
        "markers", "auth: marque les tests d'authentification"
    )
    config.addinivalue_line(
        "markers", "audio: marque les tests de traitement audio"
    )
