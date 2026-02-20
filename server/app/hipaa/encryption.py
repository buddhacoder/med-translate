"""
HIPAA Encryption Manager — AES-256-GCM for any data at rest.
All audio is processed in-memory and never persisted, but this module
provides encryption for session metadata if needed.
"""
import os
import logging
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger("medtranslate.encryption")


class EncryptionManager:
    """AES-256-GCM encryption for HIPAA-compliant data handling."""

    def __init__(self, key=None):
        if key is None:
            key = os.urandom(32)  # 256-bit key
        self._aesgcm = AESGCM(key)

    def encrypt(self, plaintext: bytes) -> tuple[bytes, bytes]:
        """Encrypt data with AES-256-GCM. Returns (nonce, ciphertext)."""
        nonce = os.urandom(12)  # 96-bit nonce
        ciphertext = self._aesgcm.encrypt(nonce, plaintext, None)
        return nonce, ciphertext

    def decrypt(self, nonce: bytes, ciphertext: bytes) -> bytes:
        """Decrypt AES-256-GCM encrypted data."""
        return self._aesgcm.decrypt(nonce, ciphertext, None)
