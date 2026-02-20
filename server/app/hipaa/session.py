"""
Session Manager — in-memory session tracking with HIPAA-compliant cleanup.
No PHI is stored in sessions — only metadata (IDs, languages, timestamps).
"""
import logging
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Dict, Optional

logger = logging.getLogger("medtranslate.session")


@dataclass
class Session:
    session_id: str
    from_lang: str
    to_lang: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    active: bool = True
    _end_time: datetime = None

    @property
    def duration_seconds(self) -> int:
        end = self._end_time or datetime.now(timezone.utc)
        return int((end - self.created_at).total_seconds())


class SessionManager:
    """Manages active translation sessions in-memory."""

    def __init__(self):
        self._sessions: Dict[str, Session] = {}

    async def create(self, session_id: str, from_lang: str, to_lang: str) -> Session:
        session = Session(
            session_id=session_id,
            from_lang=from_lang,
            to_lang=to_lang,
        )
        self._sessions[session_id] = session
        logger.info(f"Session created: {session_id[:8]}… ({from_lang}→{to_lang})")
        return session

    def is_active(self, session_id: str) -> bool:
        session = self._sessions.get(session_id)
        return session is not None and session.active

    async def end(self, session_id: str):
        session = self._sessions.get(session_id)
        if session:
            session.active = False
            session._end_time = datetime.now(timezone.utc)
            logger.info(f"Session ended: {session_id[:8]}… ({session.duration_seconds}s)")

    def get_duration(self, session_id: str) -> int:
        session = self._sessions.get(session_id)
        return session.duration_seconds if session else 0

    def cleanup_expired(self, max_age_minutes: int = 120):
        """Remove sessions older than max_age_minutes."""
        now = datetime.now(timezone.utc)
        expired = [
            sid for sid, s in self._sessions.items()
            if not s.active and (now - s.created_at).total_seconds() > max_age_minutes * 60
        ]
        for sid in expired:
            del self._sessions[sid]
        if expired:
            logger.info(f"Cleaned up {len(expired)} expired sessions")
