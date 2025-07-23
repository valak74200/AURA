"""
Routes d'authentification pour AURA
Gestion de l'inscription, connexion, profil utilisateur
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import structlog

from app.database import get_database
from models.user import (
    UserCreate, UserLogin, UserResponse, UserWithProfile, 
    UserProfileUpdate, UserProfileResponse, Token, ChangePassword
)
from services.auth_service import auth_service, get_current_user, get_current_user_optional
from utils.exceptions import AuthenticationError, ValidationError

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_create: UserCreate,
    db: AsyncSession = Depends(get_database)
):
    """
    Inscription d'un nouvel utilisateur
    """
    try:
        user = await auth_service.create_user(db, user_create)
        logger.info("User registered successfully", user_id=str(user.id), username=user.username)
        return UserResponse.from_orm(user)
    
    except ValidationError as e:
        logger.warning("Registration validation error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Registration error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de l'inscription"
        )

@router.post("/login", response_model=Token)
async def login(
    user_login: UserLogin,
    db: AsyncSession = Depends(get_database)
):
    """
    Connexion d'un utilisateur
    """
    try:
        token = await auth_service.login_user(db, user_login)
        logger.info("User logged in successfully", username=user_login.email_or_username)
        return token
    
    except AuthenticationError as e:
        logger.warning("Login authentication error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        logger.error("Login error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la connexion"
        )

@router.get("/me", response_model=UserWithProfile)
async def get_current_user_profile(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_database)
):
    """
    Récupérer le profil de l'utilisateur actuel
    """
    try:
        # Charger le profil utilisateur
        await db.refresh(current_user, ["profile"])
        
        user_response = UserResponse.from_orm(current_user)
        profile_response = None
        
        if current_user.profile:
            profile_response = UserProfileResponse.from_orm(current_user.profile)
        
        return UserWithProfile(
            **user_response.dict(),
            profile=profile_response
        )
    
    except Exception as e:
        logger.error("Error fetching user profile", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la récupération du profil"
        )

@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    profile_update: UserProfileUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_database)
):
    """
    Mettre à jour le profil de l'utilisateur actuel
    """
    try:
        # Mettre à jour les informations utilisateur
        update_data = profile_update.dict(exclude_unset=True)
        
        # Séparer les champs utilisateur des champs profil
        user_fields = ["first_name", "last_name", "language"]
        profile_fields = ["bio", "company", "position", "website"]
        
        # Mettre à jour l'utilisateur
        for field in user_fields:
            if field in update_data:
                setattr(current_user, field, update_data[field])
        
        # Charger ou créer le profil
        await db.refresh(current_user, ["profile"])
        if not current_user.profile:
            from models.user import UserProfile
            current_user.profile = UserProfile(user_id=current_user.id)
            db.add(current_user.profile)
        
        # Mettre à jour le profil
        for field in profile_fields:
            if field in update_data:
                setattr(current_user.profile, field, update_data[field])
        
        await db.commit()
        await db.refresh(current_user)
        
        logger.info("User profile updated successfully", user_id=str(current_user.id))
        return UserResponse.from_orm(current_user)
    
    except Exception as e:
        await db.rollback()
        logger.error("Error updating user profile", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la mise à jour du profil"
        )

@router.post("/change-password")
async def change_password(
    password_change: ChangePassword,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_database)
):
    """
    Changer le mot de passe de l'utilisateur actuel
    """
    try:
        # Vérifier que les nouveaux mots de passe correspondent
        if password_change.new_password != password_change.confirm_password:
            raise ValidationError("Les nouveaux mots de passe ne correspondent pas")
        
        # Vérifier l'ancien mot de passe
        if not auth_service.verify_password(password_change.current_password, current_user.hashed_password):
            raise AuthenticationError("Mot de passe actuel incorrect")
        
        # Mettre à jour le mot de passe
        current_user.hashed_password = auth_service.get_password_hash(password_change.new_password)
        await db.commit()
        
        logger.info("Password changed successfully", user_id=str(current_user.id))
        return {"message": "Mot de passe modifié avec succès"}
    
    except (ValidationError, AuthenticationError) as e:
        logger.warning("Password change validation error", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        await db.rollback()
        logger.error("Error changing password", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors du changement de mot de passe"
        )

@router.post("/logout")
async def logout(current_user = Depends(get_current_user)):
    """
    Déconnexion (côté client principalement)
    Note: Avec JWT, la déconnexion se fait côté client en supprimant le token
    """
    logger.info("User logged out", user_id=str(current_user.id))
    return {"message": "Déconnexion réussie"}

@router.get("/check", response_model=UserResponse)
async def check_auth(current_user = Depends(get_current_user)):
    """
    Vérifier si l'utilisateur est authentifié
    """
    return UserResponse.from_orm(current_user)

# Route publique pour vérifier la disponibilité d'un email/username
@router.post("/check-availability")
async def check_availability(
    data: dict,
    db: AsyncSession = Depends(get_database)
):
    """
    Vérifier la disponibilité d'un email ou nom d'utilisateur
    """
    try:
        email = data.get("email")
        username = data.get("username")
        
        result = {"available": True, "message": ""}
        
        if email:
            existing_email = await auth_service.get_user_by_email(db, email)
            if existing_email:
                result["available"] = False
                result["message"] = "Cette adresse email est déjà utilisée"
                return result
        
        if username:
            existing_username = await auth_service.get_user_by_username(db, username)
            if existing_username:
                result["available"] = False
                result["message"] = "Ce nom d'utilisateur est déjà pris"
                return result
        
        return result
    
    except Exception as e:
        logger.error("Error checking availability", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la vérification"
        ) 