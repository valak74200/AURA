"""
Storage service for AURA session and data management.
"""

from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime

from models.session import PresentationSessionData, SessionStatus
from models.feedback import SessionFeedback
from utils.logging import get_logger

logger = get_logger(__name__)


class StorageService:
    """Service for data storage and session management."""
    
    def __init__(self):
        self.logger = logger
        # In-memory storage for development (replace with Redis/DB in production)
        self._sessions: Dict[UUID, PresentationSessionData] = {}
        self._feedback: Dict[UUID, List[SessionFeedback]] = {}
    
    async def create_session(self, session: PresentationSessionData) -> PresentationSessionData:
        """Create a new presentation session."""
        self._sessions[session.id] = session
        self._feedback[session.id] = []
        logger.info(f"Created session {session.id}")
        return session
    
    async def get_session(self, session_id: UUID) -> Optional[PresentationSessionData]:
        """Retrieve a session by ID."""
        return self._sessions.get(session_id)
    
    async def update_session(self, session_id: UUID, updates: Dict[str, Any]) -> Optional[PresentationSessionData]:
        """Update session data."""
        if session_id not in self._sessions:
            return None
        
        session = self._sessions[session_id]
        for key, value in updates.items():
            if hasattr(session, key):
                setattr(session, key, value)
        
        logger.info(f"Updated session {session_id}")
        return session
    
    async def delete_session(self, session_id: UUID) -> bool:
        """Delete a session."""
        if session_id in self._sessions:
            del self._sessions[session_id]
            if session_id in self._feedback:
                del self._feedback[session_id]
            logger.info(f"Deleted session {session_id}")
            return True
        return False
    
    async def list_sessions(self, user_id: Optional[str] = None, status: Optional[SessionStatus] = None) -> List[PresentationSessionData]:
        """List sessions with optional filters."""
        sessions = list(self._sessions.values())
        
        if status:
            sessions = [s for s in sessions if s.status == status]
        
        return sessions
    
    async def store_feedback(self, session_id: UUID, feedback: SessionFeedback) -> bool:
        """Store feedback for a session."""
        if session_id not in self._feedback:
            self._feedback[session_id] = []
        
        self._feedback[session_id].append(feedback)
        logger.info(f"Stored feedback for session {session_id}")
        return True
    
    async def get_session_feedback(self, session_id: UUID) -> List[SessionFeedback]:
        """Get all feedback for a session."""
        return self._feedback.get(session_id, []) 