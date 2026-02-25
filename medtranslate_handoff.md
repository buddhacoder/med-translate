# MedTranslate Project Handoff

## Overview
**Project Path:** `/Users/macstudiodaddy/.gemini/antigravity/brain/Notebook_AG/med-translate`
**Public URL:** `https://translate.theaidoc.ai`

MedTranslate is a HIPAA-compliant, real-time medical translation Progressive Web App (PWA) designed for clinical environments. It features a completely custom, glass-morphic vanilla HTML/CSS/JS frontend and a Python FastAPI backend that interfaces with an open-source NVIDIA Riva model for translation and Supabase for auth/storage.

## Architecture & Stack
- **Frontend:** Vanilla JS/HTML/CSS, bundled with Vite (runs on port `3005`). Features a native-feeling UI with swipeable elements, SVG flag carousels, and an inline scrollable phrase dock.
- **Service Worker:** Custom caching (`sw.js`) currently sitting at version `v13`.
- **Backend:** FastAPI (`main.py`, `translation.py`, `database.py`) running on port `8000`. Handles WebSocket audio/text translation tunneling and Supabase inserts.
- **Translation Engine:** Currently uses an OpenAI-compatible endpoint pointed at a local LLM (`http://100.82.164.71:8000/v1/chat/completions`) utilizing a prompt engineered for clinical accuracy.
- **Database:** Supabase for Authentication, User Sessions, Audit Trails, and Voice Data Collection.
- **Infrastructure:** Dual MacOS `launchd` daemons (`ai.theaidoc.medtranslate-frontend`, `ai.theaidoc.medtranslate-backend`) and a Cloudflare Tunnel binding `localhost:3005` to the public domain.

## Recent Features Implemented (Phases 10-13)
1. **Hybrid Authentication:** Users can log in via Google, Apple, or continue as a Guest. Premium features (Voice Model Contribution) are restricted to authenticated users.
2. **Medical Specialty Selection:** Translators choose their clinical role (Anesthesia, ER, Pediatrics, General) which dynamically changes the context of the app.
3. **Inline Quick Phrases Dock:** The "presets" sliding panel was refactored into a permanent, scrollable dock situated right below the active translation bubbles in the session viewport. This allows doctors to rapidly tap pre-defined clinical phrases (e.g., "Take a deep breath") that instantly translate and play audio without breaking eye contact or dealing with UI overlays.
4. **Voice Training Portal:** A dedicated "Contribute to Voice Model" screen where authenticated Haitian Creole speakers can record high-fidelity voice samples (`.webm`) directly to Supabase storage to train future TTS models.
5. **UI & Layout Stabilization:** Perfected the 2x2 CSS Grid for specialty selection, eliminated annoying "session started" toasts that blocked the microphone slider, and verified seamless backwards navigation routing.

## Pending Tasks / Next Steps
- Implement **Validation Mode** for native speakers to RLHF (approve/reject) synthetic audio.
- Expand the frontend to handle **Custom User Presets** saved to `localStorage` or Supabase.
- Optimize the layout for larger desktop viewports (currently highly optimized for mobile).
- Migrate from native Browser ASR/TTS to full loop NVIDIA Riva ASR/TTS streams over WebSocket for lower latency, when the GPU server is fully provisioned.

## How to Resume
To continue development seamlessly in the new conversation, provide this summary to the fresh agent:
`Please read /Users/macstudiodaddy/.gemini/antigravity/brain/ebaefd03-47ab-46e2-951e-456fdd2f4663/medtranslate_handoff.md and continue assisting me with the MedTranslate project.`
