"""
MedTranslate — Haitian Creole TTS on Modal
Serverless function running Meta MMS (facebook/mms-tts-hat).
Scales to zero when idle ($0), wakes in ~1-2s on first request.

Deploy:  modal deploy modal_tts.py
Test:    modal serve modal_tts.py  (local dev server)
"""
import io
import modal

app = modal.App("medtranslate-tts")

# Pre-built container image with all dependencies baked in
tts_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("transformers", "torch", "numpy", "scipy", "fastapi")
    .run_commands("python -c \"from transformers import VitsModel, AutoTokenizer; VitsModel.from_pretrained('facebook/mms-tts-hat'); AutoTokenizer.from_pretrained('facebook/mms-tts-hat')\"")
)


@app.function(
    image=tts_image,
    container_idle_timeout=300,  # Keep warm for 5 min after last request
    timeout=60,
)
@modal.web_endpoint(method="POST")
def generate_tts(item: dict):
    """
    POST JSON: {"text": "Ki jan ou santi ou jodi a?", "lang": "ht"}
    Returns: WAV audio bytes
    """
    import wave
    import time
    import numpy as np
    import torch
    from transformers import VitsModel, AutoTokenizer
    from fastapi.responses import Response

    text = item.get("text", "")
    if not text:
        return Response(content="Missing text", status_code=400)

    t0 = time.time()

    model = VitsModel.from_pretrained("facebook/mms-tts-hat")
    tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-hat")

    inputs = tokenizer(text, return_tensors="pt")
    with torch.no_grad():
        output = model(**inputs).waveform

    waveform = output.squeeze().cpu().numpy()
    sample_rate = model.config.sampling_rate

    # Convert to 16-bit PCM WAV
    pcm = (waveform * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())
    buf.seek(0)

    elapsed = time.time() - t0
    audio_duration = len(waveform) / sample_rate
    print(f"Generated {audio_duration:.1f}s audio in {elapsed:.1f}s")

    return Response(
        content=buf.read(),
        media_type="audio/wav",
        headers={"Content-Disposition": "inline"},
    )
