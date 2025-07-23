"""
Modèles pour la gestion des utilisateurs
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from pydantic import BaseModel, EmailStr, Field
import uuid

from app.database import Base

# ============================================================================
# MODÈLES SQLALCHEMY (BASE DE DONNÉES)
# ============================================================================

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    
    # Statut du compte
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_premium = Column(Boolean, default=False)
    
    # Métadonnées
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # Préférences utilisateur
    language = Column(String(10), default="fr")
    timezone = Column(String(50), default="Europe/Paris")
    
    # Relations
    sessions = relationship("PresentationSession", back_populates="user")
    
    def __repr__(self):
        return f"<User {self.username} ({self.email})>"

class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Informations du profil
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    company = Column(String(200), nullable=True)
    position = Column(String(200), nullable=True)
    website = Column(String(300), nullable=True)
    
    # Statistiques
    total_sessions = Column(Integer, default=0)
    total_practice_time = Column(Integer, default=0)  # en secondes
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relations
    user = relationship("User", backref="profile")

# ============================================================================
# MODÈLES PYDANTIC (API)
# ============================================================================

class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    language: str = Field("fr", pattern="^(fr|en|es|de)$")

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str = Field(..., min_length=8, max_length=100)
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "username": "johndoe",
                "password": "motdepasse123",
                "confirm_password": "motdepasse123",
                "first_name": "John",
                "last_name": "Doe",
                "language": "fr"
            }
        }

class UserLogin(BaseModel):
    email_or_username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)
    
    class Config:
        json_schema_extra = {
            "example": {
                "email_or_username": "user@example.com",
                "password": "motdepasse123"
            }
        }

class UserResponse(UserBase):
    id: uuid.UUID
    is_active: bool
    is_verified: bool
    is_premium: bool
    created_at: datetime
    last_login: Optional[datetime]
    
    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=1000)
    company: Optional[str] = Field(None, max_length=200)
    position: Optional[str] = Field(None, max_length=200)
    website: Optional[str] = Field(None, max_length=300)
    language: Optional[str] = Field(None, pattern="^(fr|en|es|de)$")

class UserProfileResponse(BaseModel):
    id: uuid.UUID
    bio: Optional[str]
    avatar_url: Optional[str]
    company: Optional[str]
    position: Optional[str]
    website: Optional[str]
    total_sessions: int
    total_practice_time: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserWithProfile(UserResponse):
    profile: Optional[UserProfileResponse] = None

# ============================================================================
# MODÈLES D'AUTHENTIFICATION
# ============================================================================

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # en secondes
    user: UserResponse

class TokenData(BaseModel):
    user_id: Optional[str] = None
    username: Optional[str] = None

class PasswordReset(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str = Field(..., min_length=8, max_length=100)

class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str = Field(..., min_length=8, max_length=100) 