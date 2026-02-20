"""
HIPAA Audit Trail — logs session events locally (Supabase optional).
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger("medtranslate.audit")


class AuditLogger:
    """Logs HIPAA-required audit events. Falls back to local logging if Supabase unavailable."""

    def __init__(self):
        self._supabase = None
        self._init_attempted = False

    def _try_init_supabase(self):
        if self._init_attempted:
            return
        self._init_attempted = True
        try:
            from supabase import create_client
            from ..config import settings
            if settings.supabase_url and settings.supabase_service_key:
                self._supabase = create_client(
                    settings.supabase_url,
                    settings.supabase_service_key,
                )
                logger.info("Supabase audit logger connected")
        except Exception as e:
            logger.warning("Supabase not available: %s — audit logs local only", e)

    async def log(
        self,
        event: str,
        session_id: str,
        details: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ):
        """Log a HIPAA audit event. Never crashes — always logs locally."""
        logger.info("AUDIT: %s | session=%s | %s", event, session_id[:8], details)

        # Optionally persist to Supabase
        try:
            self._try_init_supabase()
            if self._supabase:
                self._supabase.table("audit_trail").insert({
                    "session_id": session_id,
                    "event_type": event,
                    "details": details or {},
                }).execute()
        except Exception as e:
            logger.warning("Supabase audit write failed: %s", e)
