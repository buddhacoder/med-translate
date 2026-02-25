"""
Local TTS service using Meta MMS (Massively Multilingual Speech).
Generates audio for Haitian Creole using the facebook/mms-tts-hat model.
Runs entirely on-device — no API key, no cost, correct Creole pronunciation.
Uses MPS (Metal) GPU acceleration on Apple Silicon for fast inference.
"""
import io
import logging
import time
import torch
import numpy as np
from transformers import VitsModel, AutoTokenizer

logger = logging.getLogger("medtranslate.tts")


class LocalTTS:
    """Haitian Creole TTS using Meta MMS, loaded once at startup."""

    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.sample_rate = 16000
        self.device = "cpu"
        self._ready = False

    async def initialize(self):
        """Load the MMS Haitian Creole model. Called once during server startup."""
        # VITS architecture is sequential — MPS GPU is actually slower
        # due to data transfer overhead. CPU on Apple Silicon is fastest.
        self.device = "cpu"

        logger.info("Loading Meta MMS model on device=%s ...", self.device)
        try:
            self.model = VitsModel.from_pretrained("facebook/mms-tts-hat")
            self.model = self.model.to(self.device)
            self.tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-hat")
            self.sample_rate = self.model.config.sampling_rate
            self._ready = True

            # Warm up with a short phrase so first real request is fast
            logger.info("Warming up model...")
            warmup_inputs = self.tokenizer("Bonjou", return_tensors="pt").to(self.device)
            with torch.no_grad():
                self.model(**warmup_inputs)
            logger.info("MMS model ready (device=%s, sample_rate=%d)", self.device, self.sample_rate)
        except Exception as e:
            logger.error("Failed to load MMS model: %s", e)
            self._ready = False

    @property
    def is_ready(self) -> bool:
        return self._ready

    def generate(self, text: str) -> bytes:
        """
        Generate WAV audio bytes from Haitian Creole text.
        Returns raw WAV file bytes ready to serve.
        """
        if not self._ready:
            raise RuntimeError("MMS model not loaded")

        t0 = time.time()
        inputs = self.tokenizer(text, return_tensors="pt").to(self.device)

        with torch.no_grad():
            output = self.model(**inputs).waveform

        waveform = output.squeeze().cpu().numpy()
        elapsed = time.time() - t0
        logger.info("TTS generated %.2fs audio in %.2fs (device=%s)",
                     len(waveform) / self.sample_rate, elapsed, self.device)

        # Convert to 16-bit PCM WAV
        pcm = (waveform * 32767).astype(np.int16)

        # Build WAV file in memory
        buf = io.BytesIO()
        import wave
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(self.sample_rate)
            wf.writeframes(pcm.tobytes())

        buf.seek(0)
        return buf.read()
