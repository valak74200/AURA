"""
Routes API pour la gestion des données utilisateur.

Endpoints pour l'historique des sessions, statistiques personnelles,
et autres fonctionnalités spécifiques à l'utilisateur connecté.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database
from models.session import PresentationSessionResponse, PresentationSession as PresentationSessionDB, SessionStatus
from models.user import User
from services.auth_service import get_current_user
from utils.logging import get_logger
from utils.exceptions import SessionNotFoundError, ValidationError

logger = get_logger(__name__)

router = APIRouter()


@router.get("/sessions", response_model=List[PresentationSessionResponse])
async def get_user_sessions(
    current_user: User = Depends(get_current_user),
    status_filter: Optional[SessionStatus] = Query(None, description="Filtrer par statut de session"),
    limit: int = Query(50, ge=1, le=100, description="Nombre maximum de sessions à retourner"),
    offset: int = Query(0, ge=0, description="Nombre de sessions à ignorer"),
    db: AsyncSession = Depends(get_database)
):
    """
    Récupérer l'historique des sessions de l'utilisateur connecté.
    
    Retourne la liste des sessions de présentation de l'utilisateur,
    triées par date de création (plus récentes en premier).
    """
    try:
        logger.info(f"Fetching sessions for user {current_user.id}")
        
        # Construire la requête de base
        from sqlalchemy import select, desc
        query = select(PresentationSessionDB).where(
            PresentationSessionDB.user_id == current_user.id
        ).order_by(desc(PresentationSessionDB.created_at))
        
        # Appliquer le filtre de statut si fourni
        if status_filter:
            query = query.where(PresentationSessionDB.status == status_filter.value)
        
        # Appliquer la pagination
        query = query.offset(offset).limit(limit)
        
        # Exécuter la requête
        result = await db.execute(query)
        sessions = result.scalars().all()
        
        logger.info(f"Found {len(sessions)} sessions for user {current_user.id}")
        
        # Convertir en modèles Pydantic
        response_sessions = []
        for session in sessions:
            session_dict = {
                "id": str(session.id),
                "user_id": str(session.user_id) if session.user_id else None,
                "title": session.title,
                "session_type": session.session_type,
                "language": session.language,
                "status": session.status,
                "created_at": session.created_at,
                "started_at": session.started_at,
                "ended_at": session.ended_at,
                "duration": session.duration or 0,
                "config": session.config,
                "stats": session.stats,
                "feedback_summary": session.feedback_summary
            }
            response_sessions.append(PresentationSessionResponse(**session_dict))
        
        return response_sessions
        
    except Exception as e:
        logger.error(f"Error fetching user sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la récupération des sessions"
        )


@router.get("/sessions/{session_id}", response_model=PresentationSessionResponse)
async def get_user_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database)
):
    """
    Récupérer les détails d'une session spécifique de l'utilisateur.
    
    L'utilisateur ne peut accéder qu'à ses propres sessions.
    """
    try:
        logger.info(f"Fetching session {session_id} for user {current_user.id}")
        
        from sqlalchemy import select
        query = select(PresentationSessionDB).where(
            PresentationSessionDB.id == session_id,
            PresentationSessionDB.user_id == current_user.id
        )
        
        result = await db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            raise SessionNotFoundError(str(session_id))
        
        logger.info(f"Found session {session_id} for user {current_user.id}")
        
        # Convertir en modèle Pydantic
        session_dict = {
            "id": str(session.id),
            "user_id": str(session.user_id) if session.user_id else None,
            "title": session.title,
            "session_type": session.session_type,
            "language": session.language,
            "status": session.status,
            "created_at": session.created_at,
            "started_at": session.started_at,
            "ended_at": session.ended_at,
            "duration": session.duration or 0,
            "config": session.config,
            "stats": session.stats,
            "feedback_summary": session.feedback_summary
        }
        
        return PresentationSessionResponse(**session_dict)
        
    except SessionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} non trouvée ou non autorisée"
        )
    except Exception as e:
        logger.error(f"Error fetching session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la récupération de la session"
        )


@router.delete("/sessions/{session_id}")
async def delete_user_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database)
):
    """
    Supprimer une session de l'utilisateur.
    
    L'utilisateur ne peut supprimer que ses propres sessions.
    Seules les sessions terminées ou annulées peuvent être supprimées.
    """
    try:
        logger.info(f"Deleting session {session_id} for user {current_user.id}")
        
        from sqlalchemy import select, delete
        
        # Vérifier que la session existe et appartient à l'utilisateur
        query = select(PresentationSessionDB).where(
            PresentationSessionDB.id == session_id,
            PresentationSessionDB.user_id == current_user.id
        )
        
        result = await db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            raise SessionNotFoundError(str(session_id))
        
        # Vérifier que la session peut être supprimée
        if session.status in [SessionStatus.ACTIVE.value, SessionStatus.PAUSED.value]:
            raise ValidationError(
                field_name="session_status",
                validation_issue="Impossible de supprimer une session active ou en pause"
            )
        
        # Supprimer la session
        delete_query = delete(PresentationSessionDB).where(
            PresentationSessionDB.id == session_id
        )
        
        await db.execute(delete_query)
        await db.commit()
        
        logger.info(f"Deleted session {session_id} for user {current_user.id}")
        
        return {
            "message": "Session supprimée avec succès",
            "session_id": str(session_id)
        }
        
    except SessionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} non trouvée ou non autorisée"
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except Exception as e:
        logger.error(f"Error deleting session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la suppression de la session"
        )


@router.get("/stats")
async def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database)
):
    """
    Récupérer les statistiques générales de l'utilisateur.
    
    Inclut le nombre total de sessions, temps total passé,
    et autres métriques de performance globales.
    """
    try:
        logger.info(f"Fetching stats for user {current_user.id}")
        
        from sqlalchemy import select, func
        
        # Statistiques de base
        total_sessions_query = select(func.count(PresentationSessionDB.id)).where(
            PresentationSessionDB.user_id == current_user.id
        )
        
        completed_sessions_query = select(func.count(PresentationSessionDB.id)).where(
            PresentationSessionDB.user_id == current_user.id,
            PresentationSessionDB.status == SessionStatus.COMPLETED.value
        )
        
        total_duration_query = select(func.sum(PresentationSessionDB.duration)).where(
            PresentationSessionDB.user_id == current_user.id,
            PresentationSessionDB.status == SessionStatus.COMPLETED.value
        )
        
        # Exécuter les requêtes
        total_sessions_result = await db.execute(total_sessions_query)
        completed_sessions_result = await db.execute(completed_sessions_query)
        total_duration_result = await db.execute(total_duration_query)
        
        total_sessions = total_sessions_result.scalar() or 0
        completed_sessions = completed_sessions_result.scalar() or 0
        total_duration = total_duration_result.scalar() or 0
        
        # Calculer des métriques dérivées
        completion_rate = (completed_sessions / total_sessions * 100) if total_sessions > 0 else 0
        avg_session_duration = (total_duration / completed_sessions) if completed_sessions > 0 else 0
        
        stats = {
            "user_id": str(current_user.id),
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "completion_rate": round(completion_rate, 1),
            "total_practice_time": total_duration,  # en secondes
            "average_session_duration": round(avg_session_duration, 1),
            "member_since": current_user.created_at.isoformat()
        }
        
        logger.info(f"Generated stats for user {current_user.id}: {stats}")
        return stats
        
    except Exception as e:
        logger.error(f"Error fetching user stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la récupération des statistiques"
        ) 