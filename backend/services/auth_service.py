"""
Service d'authentification pour AURA
Gestion JWT, hachage des mots de passe, et vérifications
"""

import os
from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
import uuid

from app.database import get_database
from models.user import User, UserProfile, UserCreate, UserLogin, Token, TokenData
from utils.exceptions import AuthenticationError, ValidationError
from utils.logging import get_logger

logger = get_logger(__name__)

# Configuration JWT - Utilise la configuration centralisée
from app.config import get_settings

settings = get_settings()
ALGORITHM = "HS256"

# Configuration du hachage des mots de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme pour FastAPI
security = HTTPBearer()

class AuthService:
    """Service d'authentification"""
    
    def __init__(self):
        self.pwd_context = pwd_context
        self.secret_key = settings.secret_key
        self.algorithm = ALGORITHM
        self.access_token_expire_minutes = settings.access_token_expire_minutes
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Vérifier un mot de passe"""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """Hacher un mot de passe"""
        return self.pwd_context.hash(password)
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Créer un token JWT"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> TokenData:
        """Vérifier et décoder un token JWT"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            user_id: str = payload.get("sub")
            username: str = payload.get("username")
            
            if user_id is None:
                raise AuthenticationError("Token invalide")
            
            return TokenData(user_id=user_id, username=username)
        
        except JWTError as e:
            logger.warning("JWT verification failed", extra={"error": str(e)})
            raise AuthenticationError("Token invalide ou expiré")
    
    async def get_user_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Récupérer un utilisateur par email"""
        result = await db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_username(self, db: AsyncSession, username: str) -> Optional[User]:
        """Récupérer un utilisateur par nom d'utilisateur"""
        result = await db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_id(self, db: AsyncSession, user_id: Union[str, uuid.UUID]) -> Optional[User]:
        """Récupérer un utilisateur par ID"""
        if isinstance(user_id, str):
            user_id = uuid.UUID(user_id)
        
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def authenticate_user(self, db: AsyncSession, email_or_username: str, password: str) -> Optional[User]:
        """Authentifier un utilisateur"""
        # Rechercher par email ou nom d'utilisateur
        result = await db.execute(
            select(User).where(
                or_(
                    User.email == email_or_username,
                    User.username == email_or_username
                )
            )
        )
        user = result.scalar_one_or_none()
        
        if not user:
            logger.info("Authentication failed: user not found", extra={"identifier": email_or_username})
            return None
        
        if not user.is_active:
            logger.info("Authentication failed: user inactive", extra={"user_id": str(user.id)})
            return None
        
        if not self.verify_password(password, user.hashed_password):
            logger.info("Authentication failed: wrong password", extra={"user_id": str(user.id)})
            return None
        
        # Mettre à jour la dernière connexion
        user.last_login = datetime.utcnow()
        await db.commit()
        
        logger.info("User authenticated successfully", extra={"user_id": str(user.id), "username": user.username})
        return user
    
    async def create_user(self, db: AsyncSession, user_create: UserCreate) -> User:
        """Créer un nouvel utilisateur"""
        # Vérifier que les mots de passe correspondent
        if user_create.password != user_create.confirm_password:
            raise ValidationError("password", "Les mots de passe ne correspondent pas")
        
        # Vérifier que l'email n'existe pas déjà
        existing_email = await self.get_user_by_email(db, user_create.email)
        if existing_email:
            raise ValidationError("email", "Cette adresse email est déjà utilisée")
        
        # Vérifier que le nom d'utilisateur n'existe pas déjà
        existing_username = await self.get_user_by_username(db, user_create.username)
        if existing_username:
            raise ValidationError("username", "Ce nom d'utilisateur est déjà pris")
        
        # Créer l'utilisateur
        hashed_password = self.get_password_hash(user_create.password)
        
        db_user = User(
            email=user_create.email,
            username=user_create.username,
            hashed_password=hashed_password,
            first_name=user_create.first_name,
            last_name=user_create.last_name,
            language=user_create.language
        )
        
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)
        
        # Créer le profil utilisateur
        db_profile = UserProfile(
            user_id=db_user.id
        )
        db.add(db_profile)
        await db.commit()
        
        logger.info("User created successfully", extra={"user_id": str(db_user.id), "username": db_user.username})
        return db_user
    
    async def login_user(self, db: AsyncSession, user_login: UserLogin) -> Token:
        """Connecter un utilisateur et retourner un token"""
        user = await self.authenticate_user(db, user_login.email_or_username, user_login.password)
        
        if not user:
            raise AuthenticationError("Email/nom d'utilisateur ou mot de passe incorrect")
        
        # Créer le token d'accès
        access_token_expires = timedelta(minutes=self.access_token_expire_minutes)
        access_token = self.create_access_token(
            data={"sub": str(user.id), "username": user.username},
            expires_delta=access_token_expires
        )
        
        # Importer ici pour éviter les imports circulaires
        from models.user import UserResponse
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=self.access_token_expire_minutes * 60,
            user=UserResponse.from_orm(user)
        )

# Instance globale du service
auth_service = AuthService()

# Dependency pour obtenir l'utilisateur actuel
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_database)
) -> User:
    """Dependency pour obtenir l'utilisateur actuel à partir du token"""
    try:
        token = credentials.credentials
        token_data = auth_service.verify_token(token)
        
        if token_data.user_id is None:
            raise AuthenticationError("Token invalide")
        
        user = await auth_service.get_user_by_id(db, token_data.user_id)
        if user is None:
            raise AuthenticationError("Utilisateur non trouvé")
        
        if not user.is_active:
            raise AuthenticationError("Compte utilisateur désactivé")
        
        return user
    
    except AuthenticationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Non autorisé",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Dependency pour utilisateur actuel (optionnel)
async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_database)
) -> Optional[User]:
    """Dependency pour obtenir l'utilisateur actuel (optionnel)"""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None 