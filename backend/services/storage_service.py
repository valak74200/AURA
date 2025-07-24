"""
Storage service for AURA session and data management.
"""

from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from models.session import PresentationSessionData, SessionStatus, PresentationSession
from models.feedback import SessionFeedback
from utils.logging import get_logger
from app.database import async_session_maker

logger = get_logger(__name__)


class StorageService:
    """Service for data storage and session management with database persistence."""
    
    def __init__(self):
        self.logger = logger
        # Keep in-memory cache for quick access
        self._sessions_cache: Dict[UUID, PresentationSessionData] = {}
        self._feedback_cache: Dict[UUID, List[SessionFeedback]] = {}
    
    async def create_session(self, session: PresentationSessionData) -> PresentationSessionData:
        """Create a new presentation session with database persistence."""
        try:
            async with async_session_maker() as db:
                # Create database record
                db_session = PresentationSession(
                    id=session.id,
                    user_id=session.user_id,
                    title=session.title or "Session sans titre",
                    session_type=session.config.session_type.value,
                    language=session.config.language.value,
                    status=session.status.value,
                    created_at=session.created_at,
                    started_at=session.started_at,
                    ended_at=session.ended_at,
                    duration=int(session.duration_seconds or 0),
                    config=session.config.dict(),
                    stats=session.state.dict()
                )
                
                db.add(db_session)
                await db.commit()
                
                # Cache in memory
                self._sessions_cache[session.id] = session
                self._feedback_cache[session.id] = []
                
                logger.info(f"Created session {session.id} in database")
                return session
                
        except Exception as e:
            logger.error(f"Failed to create session in database: {e}")
            # Fallback to memory storage
            self._sessions_cache[session.id] = session
            self._feedback_cache[session.id] = []
            logger.info(f"Created session {session.id} in memory (fallback)")
            return session
    
    async def get_session(self, session_id: UUID) -> Optional[PresentationSessionData]:
        """Retrieve a session by ID from cache or database."""
        # Check cache first
        if session_id in self._sessions_cache:
            return self._sessions_cache[session_id]
        
        try:
            async with async_session_maker() as db:
                result = await db.execute(
                    select(PresentationSession).where(PresentationSession.id == session_id)
                )
                db_session = result.scalar_one_or_none()
                
                if db_session:
                    # Convert to Pydantic model
                    session = self._db_to_pydantic(db_session)
                    # Cache it
                    self._sessions_cache[session_id] = session
                    return session
                    
        except Exception as e:
            logger.error(f"Failed to get session from database: {e}")
        
        return None
    
    async def update_session(self, session_id: UUID, updates: Dict[str, Any]) -> Optional[PresentationSessionData]:
        """Update session data in database and cache."""
        try:
            async with async_session_maker() as db:
                # Update database
                stmt = update(PresentationSession).where(
                    PresentationSession.id == session_id
                ).values(**self._prepare_db_updates(updates))
                
                await db.execute(stmt)
                await db.commit()
                
                # Update cache if exists
                if session_id in self._sessions_cache:
                    session = self._sessions_cache[session_id]
                    for key, value in updates.items():
                        if hasattr(session, key):
                            setattr(session, key, value)
                    logger.info(f"Updated session {session_id} in database and cache")
                    return session
                else:
                    # Reload from database
                    return await self.get_session(session_id)
                    
        except Exception as e:
            logger.error(f"Failed to update session in database: {e}")
            # Fallback to cache only
            if session_id in self._sessions_cache:
                session = self._sessions_cache[session_id]
                for key, value in updates.items():
                    if hasattr(session, key):
                        setattr(session, key, value)
                logger.info(f"Updated session {session_id} in cache (fallback)")
                return session
        
        return None
    
    async def delete_session(self, session_id: UUID) -> bool:
        """Delete a session from database and cache."""
        try:
            async with async_session_maker() as db:
                await db.execute(
                    delete(PresentationSession).where(PresentationSession.id == session_id)
                )
                await db.commit()
                
                # Remove from cache
                if session_id in self._sessions_cache:
                    del self._sessions_cache[session_id]
                if session_id in self._feedback_cache:
                    del self._feedback_cache[session_id]
                    
                logger.info(f"Deleted session {session_id} from database")
                return True
                
        except Exception as e:
            logger.error(f"Failed to delete session from database: {e}")
            # Fallback to cache only
            if session_id in self._sessions_cache:
                del self._sessions_cache[session_id]
                if session_id in self._feedback_cache:
                    del self._feedback_cache[session_id]
                logger.info(f"Deleted session {session_id} from cache (fallback)")
                return True
        
        return False
    
    async def list_sessions(self, user_id: Optional[str] = None, status: Optional[SessionStatus] = None) -> List[PresentationSessionData]:
        """List sessions with optional filters from database."""
        try:
            async with async_session_maker() as db:
                query = select(PresentationSession)
                
                if user_id:
                    query = query.where(PresentationSession.user_id == user_id)
                if status:
                    query = query.where(PresentationSession.status == status.value)
                
                query = query.order_by(PresentationSession.created_at.desc())
                
                result = await db.execute(query)
                db_sessions = result.scalars().all()
                
                # Convert to Pydantic models
                sessions = [self._db_to_pydantic(db_session) for db_session in db_sessions]
                
                # Update cache
                for session in sessions:
                    self._sessions_cache[session.id] = session
                
                return sessions
                
        except Exception as e:
            logger.error(f"Failed to list sessions from database: {e}")
            # Fallback to cache
            sessions = list(self._sessions_cache.values())
            
            if status:
                sessions = [s for s in sessions if s.status == status]
            
            return sessions
    
    async def store_feedback(self, session_id: UUID, feedback: SessionFeedback) -> bool:
        """Store feedback for a session."""
        if session_id not in self._feedback_cache:
            self._feedback_cache[session_id] = []
        
        self._feedback_cache[session_id].append(feedback)
        logger.info(f"Stored feedback for session {session_id}")
        return True
    
    async def get_session_feedback(self, session_id: UUID) -> List[SessionFeedback]:
        """Get all feedback for a session."""
        return self._feedback_cache.get(session_id, [])
    
    def _db_to_pydantic(self, db_session: PresentationSession) -> PresentationSessionData:
        """Convert database model to Pydantic model."""
        from models.session import SessionConfig, SessionState, SessionMetadata
        
        # Create config from stored JSON
        config_data = db_session.config or {}
        config = SessionConfig(**config_data)
        
        # Create state from stored JSON
        stats_data = db_session.stats or {}
        state = SessionState(**stats_data)
        
        # Create metadata
        metadata = SessionMetadata()
        
        return PresentationSessionData(
            id=db_session.id,
            user_id=str(db_session.user_id),
            config=config,
            status=SessionStatus(db_session.status),
            created_at=db_session.created_at,
            started_at=db_session.started_at,
            ended_at=db_session.ended_at,
            title=db_session.title,
            state=state,
            metadata=metadata,
            duration_seconds=float(db_session.duration) if db_session.duration else None
        )
    
    def _prepare_db_updates(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare updates for database (convert Pydantic models to dict)."""
        db_updates = {}
        
        for key, value in updates.items():
            if key == 'status' and hasattr(value, 'value'):
                db_updates['status'] = value.value
            elif key == 'config' and hasattr(value, 'dict'):
                db_updates['config'] = value.dict()
            elif key == 'state' and hasattr(value, 'dict'):
                db_updates['stats'] = value.dict()
            elif key == 'duration_seconds':
                db_updates['duration'] = int(value) if value else 0
            else:
                db_updates[key] = value
                
        return db_updates 