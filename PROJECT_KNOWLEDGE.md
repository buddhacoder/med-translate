# MedTranslate Project Context

This file contains the complete architectural and operational knowledge for the MedTranslate project. It serves as the "brain" for any AI assistant working on this codebase in a new workspace.

## 1. Project Overview & Architecture

MedTranslate is a real-time, bidirectional audio translation application designed for clinical use.

*   **Frontend**: Vite, Vanilla JS/HTML/CSS (no heavy frameworks like React).
    *   **Port**: `3000`
    *   **Local URL**: `https://localhost:3000` (must be accessed via HTTPS for microphone permissions).
*   **Backend**: FastAPI, WebSockets
    *   **Port**: `8443`
    *   **SSL**: Runs with local certificates (`cert.pem`, `key.pem`) to satisfy Cloudflare's tunneling requirements.
*   **Translation Engine**: Uses the NVIDIA Riva API (specifically `riva-translate-1.6b`) to translate between English (`en-US`) and Spanish (`es-US`).
*   **Speech Recognition**: Uses the browser's native `SpeechRecognition` API (Web Speech API).

## 2. Remote Access Pipeline (The "Always-On" Setup)

The user needed a completely hands-off way to access the app from their phone at work using cellular data, without relying on workplace Wi-Fi or changing local IP addresses daily.

### Cloudflare Tunnel

*   **URL**: `https://translate.theaidoc.ai`
*   **Domain**: Managed via Cloudflare (`amos.ns.cloudflare.com`, `khloe.ns.cloudflare.com`).
*   **Tunnel Name**: `medtranslate`
*   **Tunnel ID**: `c89aa103-1c2f-4bab-930a-1823fd1ece31`
*   **Location**: The `cloudflared` binary is installed at `~/bin/cloudflared`.
*   **Configuration**: The tunnel config is stored at `~/.cloudflared/config.yml`. It routes incoming traffic on `translate.theaidoc.ai` to `https://localhost:3000` with `noTLSVerify: true` enabled.

### macOS Launch Agents (Automation)

To automatically start the complex 3-part system on system boot, macOS `launchd` is used via plist files located in `~/Library/LaunchAgents`.

1.  **Frontend (`ai.theaidoc.medtranslate-frontend.plist`)**: Runs the Vite dev server. Relies on `npx` located at `/usr/local/bin/npx`.
2.  **Backend (`ai.theaidoc.medtranslate-backend.plist`)**: Runs the FastAPI server using the *system* Python (`python3 -m uvicorn app.main:app`). It requires SSL certificates located at `/server/certs/key.pem` and `/server/certs/cert.pem` to start successfully.
3.  **Tunnel (`ai.theaidoc.medtranslate-tunnel.plist`)**: Runs the `cloudflared tunnel run medtranslate` command.

**Important**: If the backend fails to start (Exit code 1), it is almost always because the SSL certificates are missing from the `server/certs/` directory or the Python module path (`app.main:app`) is incorrect.

## 3. Core UI/UX Mechanics

*   **Slidable Mic**: The "Hold to Translate" button implements a sliding mechanism to switch translation directions.
    *   Slide Left: English → Spanish
    *   Slide Right: Spanish → English
    *   The top-bar badge and tooltip dynamically update to reflect the direction state managed entirely in vanilla JavaScript (`client/js/app.js`).
*   **Recording Timer**: The timer (top right of the session screen) only advances when the user is actively holding the microphone button. It pauses when the mic is released.

## 4. Key Files & Directories

*   `/client/`: Vanilla web app.
    *   `/client/index.html`: The monolithic view containing all screens (Login, Language Select, Session).
    *   `/client/styles/main.css`: Core design system using a dark, premium aesthetic (glassmorphism accents, neon highlights).
    *   `/client/js/app.js`: State management, audio recording, WebSocket connection, and slider logic.
*   `/server/`: FastAPI backend.
    *   `/server/app/main.py`: The WebSocket endpoint (`/ws/translate`) serving the client. Connects to NVIDIA and handles the async translation stream.
    *   `/server/app/translation.py`: The integration layer with the `nvidia-riva-client` SDK.

## 5. Environment Variables & Secrets

The backend relies on APIs that require secrets. These MUST be present in a `.env` file inside the `/server/` directory:

*   `NVIDIA_API_KEY`: Required for the Riva APIs.

## 6. How to interact with this project in the future

If you are asked to "fix" or "start" the application:
1. Do NOT write simple shell scripts to start `npx` or `uvicorn`. The user relies on the `launchctl` setup.
2. If restarting services is required, use the designated method:
   ```bash
   launchctl unload ~/Library/LaunchAgents/ai.theaidoc.medtranslate-*.plist
   launchctl load ~/Library/LaunchAgents/ai.theaidoc.medtranslate-*.plist
   ```
3. Always check `/tmp/medtranslate-*.err` and `/tmp/medtranslate-*.log` for real debugging information of the daemonized services.
