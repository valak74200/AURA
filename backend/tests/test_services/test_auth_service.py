"""
Tests pour le service d'authentification AURA.

Test toutes les fonctionnalités du service d'authentification.
"""

import pytest
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta

from services.auth_service import AuthService
from models.user import UserCreate, UserLogin
from utils.exceptions import AuthenticationError, ValidationError


@pytest.mark.unit
@pytest.mark.asyncio
class TestAuthService:
    """Tests pour le service d'authentification."""
    
    @pytest.fixture
    def auth_service(self):
        """Instance du service d'authentification."""
        return AuthService()
    
    async def test_password_hashing(self, auth_service: AuthService):
        """Test du hachage et vérification des mots de passe."""
        password = "testpassword123"
        
        # Hacher le mot de passe
        hashed = auth_service.get_password_hash(password)
        
        # Vérifier que le hash est différent du mot de passe original
        assert hashed != password
        assert len(hashed) > 20  # Les hashes bcrypt sont longs
        
        # Vérifier que la vérification fonctionne
        assert auth_service.verify_password(password, hashed) is True
        assert auth_service.verify_password("wrongpassword", hashed) is False
    
    async def test_create_access_token(self, auth_service: AuthService):
        """Test de création de token JWT."""
        user_data = {
            "sub": "user123",
            "username": "testuser"
        }
        
        # Créer un token
        token = auth_service.create_access_token(user_data)
        
        # Vérifier que le token est une chaîne non vide
        assert isinstance(token, str)
        assert len(token) > 20
        
        # Vérifier que le token contient 3 parties (header.payload.signature)
        parts = token.split('.')
        assert len(parts) == 3
    
    async def test_verify_token_valid(self, auth_service: AuthService):
        """Test de vérification d'un token valide."""
        user_data = {
            "sub": "user123",
            "username": "testuser"
        }
        
        # Créer et vérifier un token
        token = auth_service.create_access_token(user_data)
        token_data = auth_service.verify_token(token)
        
        # Vérifier les données décodées
        assert token_data.user_id == "user123"
        assert token_data.username == "testuser"
    
    async def test_verify_token_invalid(self, auth_service: AuthService):
        """Test de vérification d'un token invalide."""
        invalid_token = "invalid.token.here"
        
        # La vérification devrait lever une exception
        with pytest.raises(AuthenticationError):
            auth_service.verify_token(invalid_token)
    
    async def test_verify_token_expired(self, auth_service: AuthService):
        """Test de vérification d'un token expiré."""
        user_data = {
            "sub": "user123",
            "username": "testuser"
        }
        
        # Créer un token avec expiration immédiate
        expired_delta = timedelta(seconds=-1)  # Déjà expiré
        token = auth_service.create_access_token(user_data, expired_delta)
        
        # La vérification devrait lever une exception
        with pytest.raises(AuthenticationError):
            auth_service.verify_token(token)
    
    async def test_create_user_success(self, auth_service: AuthService, db_session: AsyncSession):
        """Test de création d'utilisateur réussie."""
        user_data = UserCreate(
            email="newuser@example.com",
            username="newuser",
            password="password123",
            confirm_password="password123",
            first_name="New",
            last_name="User",
            language="fr"
        )
        
        # Créer l'utilisateur
        created_user = await auth_service.create_user(db_session, user_data)
        
        # Vérifications
        assert created_user.email == user_data.email
        assert created_user.username == user_data.username
        assert created_user.first_name == user_data.first_name
        assert created_user.last_name == user_data.last_name
        assert created_user.language == user_data.language
        assert created_user.is_active is True
        assert created_user.hashed_password != user_data.password  # Mot de passe haché
        assert created_user.created_at is not None
    
    async def test_create_user_password_mismatch(self, auth_service: AuthService, db_session: AsyncSession):
        """Test de création d'utilisateur avec mots de passe différents."""
        user_data = UserCreate(
            email="test@example.com",
            username="testuser",
            password="password123",
            confirm_password="differentpassword",
            first_name="Test",
            last_name="User",
            language="fr"
        )
        
        # La création devrait échouer
        with pytest.raises(ValidationError, match="mot de passe"):
            await auth_service.create_user(db_session, user_data)
    
    async def test_create_user_duplicate_email(self, auth_service: AuthService, db_session: AsyncSession, test_user: Dict[str, Any]):
        """Test de création d'utilisateur avec email déjà utilisé."""
        user_data = UserCreate(
            email=test_user["email"],  # Email déjà utilisé
            username="differentuser",
            password="password123",
            confirm_password="password123",
            first_name="Different",
            last_name="User",
            language="fr"
        )
        
        # La création devrait échouer
        with pytest.raises(ValidationError, match="email"):
            await auth_service.create_user(db_session, user_data)
    
    async def test_create_user_duplicate_username(self, auth_service: AuthService, db_session: AsyncSession, test_user: Dict[str, Any]):
        """Test de création d'utilisateur avec nom d'utilisateur déjà utilisé."""
        user_data = UserCreate(
            email="different@example.com",
            username=test_user["username"],  # Username déjà utilisé
            password="password123",
            confirm_password="password123",
            first_name="Different",
            last_name="User",
            language="fr"
        )
        
        # La création devrait échouer
        with pytest.raises(ValidationError, match="utilisateur"):
            await auth_service.create_user(db_session, user_data)
    
    async def test_get_user_by_email(self, auth_service: AuthService, db_session: AsyncSession, test_user: Dict[str, Any]):
        """Test de récupération d'utilisateur par email."""
        user = await auth_service.get_user_by_email(db_session, test_user["email"])
        
        assert user is not None
        assert user.email == test_user["email"]
        assert user.username == test_user["username"]
    
    async def test_get_user_by_email_not_found(self, auth_service: AuthService, db_session: AsyncSession):
        """Test de récupération d'utilisateur par email inexistant."""
        user = await auth_service.get_user_by_email(db_session, "nonexistent@example.com")
        
        assert user is None
    
    async def test_get_user_by_username(self, auth_service: AuthService, db_session: AsyncSession, test_user: Dict[str, Any]):
        """Test de récupération d'utilisateur par nom d'utilisateur."""
        user = await auth_service.get_user_by_username(db_session, test_user["username"])
        
        assert user is not None
        assert user.email == test_user["email"]
        assert user.username == test_user["username"]
    
    async def test_get_user_by_username_not_found(self, auth_service: AuthService, db_session: AsyncSession):
        """Test de récupération d'utilisateur par nom d'utilisateur inexistant."""
        user = await auth_service.get_user_by_username(db_session, "nonexistentuser")
        
        assert user is None
    
    async def test_get_user_by_id(self, auth_service: AuthService, db_session: AsyncSession, test_user: Dict[str, Any]):
        """Test de récupération d'utilisateur par ID."""
        user = await auth_service.get_user_by_id(db_session, test_user["id"])
        
        assert user is not None
        assert str(user.id) == test_user["id"]
        assert user.email == test_user["email"]
    
    async def test_get_user_by_id_not_found(self, auth_service: AuthService, db_session: AsyncSession):
        """Test de récupération d'utilisateur par ID inexistant."""
        from uuid import uuid4
        fake_id = str(uuid4())
        
        user = await auth_service.get_user_by_id(db_session, fake_id)
        
        assert user is None
    
    async def test_authenticate_user_success_email(self, auth_service: AuthService, db_session: AsyncSession, test_user: Dict[str, Any]):
        """Test d'authentification réussie avec email."""
        user = await auth_service.authenticate_user(
            db_session, 
            test_user["email"], 
            test_user["password"]
        )
        
        assert user is not None
        assert user.email == test_user["email"]
        assert user.username == test_user["username"]
    
    async def test_authenticate_user_success_username(self, auth_service: AuthService, db_session: AsyncSession, test_user: Dict[str, Any]):
        """Test d'authentification réussie avec nom d'utilisateur."""
        user = await auth_service.authenticate_user(
            db_session, 
            test_user["username"], 
            test_user["password"]
        )
        
        assert user is not None
        assert user.email == test_user["email"]
        assert user.username == test_user["username"]
    
    async def test_authenticate_user_wrong_password(self, auth_service: AuthService, db_session: AsyncSession, test_user: Dict[str, Any]):
        """Test d'authentification avec mauvais mot de passe."""
        user = await auth_service.authenticate_user(
            db_session, 
            test_user["email"], 
            "wrongpassword"
        )
        
        assert user is None
    
    async def test_authenticate_user_not_found(self, auth_service: AuthService, db_session: AsyncSession):
        """Test d'authentification avec utilisateur inexistant."""
        user = await auth_service.authenticate_user(
            db_session, 
            "nonexistent@example.com", 
            "password123"
        )
        
        assert user is None
    
    async def test_login_user_success(self, auth_service: AuthService, db_session: AsyncSession, test_user: Dict[str, Any]):
        """Test de connexion utilisateur réussie."""
        user_login = UserLogin(
            email_or_username=test_user["email"],
            password=test_user["password"]
        )
        
        token_response = await auth_service.login_user(db_session, user_login)
        
        # Vérifications
        assert token_response.access_token is not None
        assert token_response.token_type == "bearer"
        assert token_response.expires_in > 0
        assert token_response.user is not None
        assert token_response.user.email == test_user["email"]
        
        # Vérifier que le token est valide
        token_data = auth_service.verify_token(token_response.access_token)
        assert token_data.user_id == test_user["id"]
        assert token_data.username == test_user["username"]
    
    async def test_login_user_invalid_credentials(self, auth_service: AuthService, db_session: AsyncSession, test_user: Dict[str, Any]):
        """Test de connexion avec identifiants invalides."""
        user_login = UserLogin(
            email_or_username=test_user["email"],
            password="wrongpassword"
        )
        
        # La connexion devrait échouer
        with pytest.raises(AuthenticationError, match="incorrect"):
            await auth_service.login_user(db_session, user_login)
    
    async def test_login_user_not_found(self, auth_service: AuthService, db_session: AsyncSession):
        """Test de connexion avec utilisateur inexistant."""
        user_login = UserLogin(
            email_or_username="nonexistent@example.com",
            password="password123"
        )
        
        # La connexion devrait échouer
        with pytest.raises(AuthenticationError, match="incorrect"):
            await auth_service.login_user(db_session, user_login)
