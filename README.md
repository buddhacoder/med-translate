# MedTranslate 🏥🗣️

A HIPAA-compliant, full-duplex medical translation app for hospital bedside use.

## What It Does

Real-time voice translation between **English ↔ Spanish** and **English ↔ Haitian Creole** using your phone as a PWA. Unlike standard voice APIs, MedTranslate handles overlapping speech naturally — when the patient responds while the translation is still playing, it **doesn't stop or crash**.

## Powered By

- **[NVIDIA PersonaPlex](https://github.com/NVIDIA/personaplex)** — Full-duplex speech-to-speech model for natural conversation dynamics
- **[NVIDIA Riva NIM](https://developer.nvidia.com/riva)** — ASR, Neural Machine Translation, and TTS microservices
- **[Supabase](https://supabase.com)** — Auth + database for session management (HIPAA-conscious, no PHI stored)

## Quick Start

### Client (no GPU needed)
```bash
cd client
npm install
npm run dev
```

### Server (requires NVIDIA GPU)
```bash
cd server
pip install -r requirements.txt
cp ../.env.example ../.env  # Fill in your keys
uvicorn app.main:app --host 0.0.0.0 --port 8443
```

### Docker (recommended)
```bash
docker-compose up
```

## HIPAA Notice

This app is designed with HIPAA compliance in mind:
- **No audio is stored** — all processing is ephemeral, in-memory only
- **No transcripts saved** — only session metadata (timestamps, language pair, duration)
- **Encrypted transport** — TLS 1.3 for all connections
- **Audit trails** — all access events logged without PHI

For production hospital deployment, ensure your cloud GPU provider has a signed BAA.

## License

MIT
