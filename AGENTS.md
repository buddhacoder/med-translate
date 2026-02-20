# MedTranslate — AGENTS.md

## Project Overview

MedTranslate is a HIPAA-compliant, full-duplex medical translation app for hospital use. It uses **NVIDIA PersonaPlex** (7B speech-to-speech model) for natural conversation management and **NVIDIA Riva NIM** microservices for multilingual ASR/NMT/TTS translation. The client is a mobile-friendly PWA.

**Core problem solved**: Unlike OpenAI/Gemini voice APIs, PersonaPlex handles overlapping speech without interrupting translation output — critical when multiple people are talking in a clinical setting.

**Supported language pairs**: EN<->ES (English/Spanish), EN<->HT (English/Haitian Creole)

## Architecture

```
Phone (PWA) <-WSS-> FastAPI Server (GPU) -> PersonaPlex (full-duplex) -> Riva (ASR->NMT->TTS) -> WSS -> Phone
                                           |
                                    Supabase (session metadata + audit trail, NO PHI)
```

### Three Components

1. **server/** — Python FastAPI + WebSocket server. Runs on cloud GPU (A100). Hosts PersonaPlex and Riva pipeline.
2. **client/** — Vite + Vanilla JS PWA. Mobile-first, designed for bedside use on phones.
3. **supabase/** — SQL migrations for session tracking and HIPAA audit trails.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server framework | FastAPI + uvicorn |
| AI model | NVIDIA PersonaPlex 7B (via moshi Python package) |
| Translation | NVIDIA Riva NIM (ASR, NMT, TTS) |
| Client bundler | Vite |
| Client language | Vanilla JavaScript (no framework) |
| Styling | Vanilla CSS |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Audio transport | WebSocket (binary frames for audio, JSON for control messages) |
| Audio format | 24kHz WAV/WebAudio (PersonaPlex requirement) |

## HIPAA Constraints — CRITICAL

Jules MUST follow these rules in ALL code:

1. **NEVER log audio content, transcripts, or any patient speech** to files, console, or database
2. **NEVER write audio to disk** — all audio processing must be in-memory only
3. **All audio buffers must be ephemeral** — zeroed out and freed when session ends
4. **Session metadata only** — the database stores: session ID, user ID, timestamps, language pair, duration. NOTHING about what was said
5. **Audit trail** — log authentication events, session lifecycle events, but NEVER conversation content
6. **TLS everywhere** — WebSocket connections must use WSS (TLS 1.3)
7. **AES-256-GCM** for any in-memory audio buffer encryption

## Implementation Phases

Complete in order. **Phases 1-6 can be built and tested without a GPU.**

### Phase 1: Project Scaffolding
- README.md, .env.example, docker-compose.yml
- client/package.json with Vite
- server/requirements.txt

### Phase 2: Supabase Migrations
- 001_sessions.sql — translation_sessions table
- 002_audit_trail.sql — hipaa_audit_trail table
- 003_rls_policies.sql — RLS policies

### Phase 3: Client PWA Shell
- index.html, manifest.json, sw.js, app.css, vite.config.js

### Phase 4: Client Core Logic
- auth.js — Supabase PIN login + session token management
- ui.js — State machine: login -> setup -> active -> ended
- audio.js — WebAudio API mic capture at 24kHz, playback queue
- websocket.js — WSS with binary audio frames + JSON control messages
- session.js — Client-side session lifecycle

### Phase 5: Server Core
- config.py — Pydantic BaseSettings for all env vars
- main.py — FastAPI app, health endpoint, WebSocket /ws/translate

### Phase 6: Server HIPAA Layer
- hipaa/audit.py — Log events to Supabase REST API
- hipaa/encryption.py — AES-256-GCM for in-memory buffers
- hipaa/session.py — Session lifecycle + auto-purge

### Phase 7: PersonaPlex Integration
- personaplex.py — Load model via HuggingFace, configure voice + text prompt

### Phase 8: Riva Translation Pipeline
- translation.py — Riva gRPC client for ASR, NMT, TTS
- Support EN<->ES and EN<->HT

### Phase 9: Docker + Integration
- server/Dockerfile (CUDA base image), docker-compose.yml, e2e testing

## Key Persona Prompt

Use this exact prompt for PersonaPlex text prompt in medical translation mode:

```
You are a professional medical interpreter. You facilitate clear communication
between English-speaking medical staff and patients who speak Spanish or
Haitian Creole. Repeat what each speaker says in the other language. Use
simple, patient-friendly translations. Preserve medical terminology accurately.
Never add your own commentary or medical advice. If you are unsure of a term,
say it in both languages.
```

## Voice Recommendations

- **NATF2** — Natural female voice (warm, professional)
- **NATM1** — Natural male voice (calm, clear)

## Environment Variables

```
HF_TOKEN=
PERSONAPLEX_VOICE=NATF2
PERSONAPLEX_CPU_OFFLOAD=false
RIVA_API_URL=
RIVA_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
SERVER_PORT=8443
SESSION_TIMEOUT_MINUTES=30
MAX_SESSION_DURATION_MINUTES=120
SUPPORTED_LANGUAGES=en,es,ht
DEFAULT_LANGUAGE_PAIR=en-es
TLS_CERT_PATH=
TLS_KEY_PATH=
```

## Running Locally

```bash
cd client && npm install && npm run dev      # Client (no GPU)
cd server && pip install -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port 8443
docker-compose up                             # Full stack
```

## Testing

```bash
cd server && pytest tests/ -v
cd client && npm run dev   # Then open on phone at local network URL
```

## Design Requirements

- **Dark mode** — deep navy/charcoal with clean white text
- **High contrast** — readable in bright hospital lighting
- **Large touch targets** — minimum 48px, usable with gloved hands
- **Mobile-first** — phone portrait optimized
- **Premium feel** — glassmorphism, smooth transitions, micro-animations
- **Three screens**: Login (PIN) -> Setup (language pair: ES or HT) -> Active Translation (waveform + status)
- **Language selector** must prominently show Spanish and Haitian Creole with flag icons
