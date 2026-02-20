#!/bin/bash
# ===========================================================
# MedTranslate — Cloudflare Tunnel Setup (ONE-TIME, FULLY AUTOMATIC)
# Domain: translate.theaidoc.ai
# After this: everything starts on boot. Zero daily effort.
# ===========================================================
set -e

DOMAIN="theaidoc.ai"
SUBDOMAIN="translate"
TUNNEL_NAME="medtranslate"
LOCAL_PORT="3000"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
USER_HOME="$HOME"
LAUNCH_DIR="$USER_HOME/Library/LaunchAgents"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   MedTranslate — One-Time Tunnel Setup              ║"
echo "║   Target: https://${SUBDOMAIN}.${DOMAIN}            ║"
echo "║   After this: fully automatic, zero daily effort    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Install cloudflared ──
if command -v cloudflared &>/dev/null; then
  echo "✅ cloudflared already installed: $(cloudflared --version 2>&1 | head -1)"
else
  echo "📦 Installing cloudflared..."
  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ]; then
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz" -o /tmp/cloudflared.tgz
  else
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz" -o /tmp/cloudflared.tgz
  fi
  tar -xzf /tmp/cloudflared.tgz -C /tmp/
  sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
  sudo chmod +x /usr/local/bin/cloudflared
  rm -f /tmp/cloudflared.tgz
  echo "✅ cloudflared installed: $(cloudflared --version 2>&1 | head -1)"
fi

# ── Step 2: Authenticate ──
echo ""
echo "🔐 Step 2: Authenticate with Cloudflare"
echo "   Your browser will open. Log in and select your domain."
echo "   Press Enter when ready..."
read -r
cloudflared tunnel login
echo "✅ Authenticated!"

# ── Step 3: Create tunnel ──
echo ""
echo "🚇 Step 3: Creating tunnel '${TUNNEL_NAME}'..."
cloudflared tunnel create ${TUNNEL_NAME} 2>/dev/null || echo "   (Tunnel already exists, continuing...)"

TUNNEL_ID=$(ls ~/.cloudflared/ | grep -E "^[0-9a-f-]+\.json$" | head -1 | sed 's/.json//')
if [ -z "$TUNNEL_ID" ]; then
  echo "❌ Could not find tunnel credentials. Please try again."
  exit 1
fi
echo "✅ Tunnel ID: ${TUNNEL_ID}"

# ── Step 4: DNS route ──
echo ""
echo "🌐 Step 4: ${SUBDOMAIN}.${DOMAIN} → tunnel"
cloudflared tunnel route dns ${TUNNEL_NAME} ${SUBDOMAIN}.${DOMAIN} 2>/dev/null || echo "   (DNS record already exists, continuing...)"
echo "✅ DNS configured!"

# ── Step 5: Config file ──
echo ""
echo "📝 Step 5: Writing tunnel config..."
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << CFGEOF
tunnel: ${TUNNEL_ID}
credentials-file: ${USER_HOME}/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: ${SUBDOMAIN}.${DOMAIN}
    service: https://localhost:${LOCAL_PORT}
    originRequest:
      noTLSVerify: true
  # Future apps:
  # - hostname: piano.${DOMAIN}
  #   service: http://localhost:5173
  - service: http_status:404
CFGEOF
echo "✅ Config saved"

# ── Step 6: Auto-start Launch Agents ──
echo ""
echo "⚙️  Step 6: Setting up auto-start on boot..."
mkdir -p "$LAUNCH_DIR"
mkdir -p "$PROJECT_DIR/logs"

# === Agent 1: FastAPI Backend ===
cat > "$LAUNCH_DIR/ai.theaidoc.medtranslate-backend.plist" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.theaidoc.medtranslate-backend</string>
  <key>ProgramArguments</key>
  <array>
    <string>${PROJECT_DIR}/server/venv/bin/uvicorn</string>
    <string>app.main:app</string>
    <string>--host</string>
    <string>0.0.0.0</string>
    <string>--port</string>
    <string>8443</string>
    <string>--ssl-keyfile</string>
    <string>${PROJECT_DIR}/server/certs/key.pem</string>
    <string>--ssl-certfile</string>
    <string>${PROJECT_DIR}/server/certs/cert.pem</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${PROJECT_DIR}/server</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${PROJECT_DIR}/logs/backend.log</string>
  <key>StandardErrorPath</key>
  <string>${PROJECT_DIR}/logs/backend-error.log</string>
</dict>
</plist>
PLISTEOF

# === Agent 2: Vite Frontend ===
cat > "$LAUNCH_DIR/ai.theaidoc.medtranslate-frontend.plist" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.theaidoc.medtranslate-frontend</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/npx</string>
    <string>vite</string>
    <string>--host</string>
    <string>0.0.0.0</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${PROJECT_DIR}/client</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${PROJECT_DIR}/logs/frontend.log</string>
  <key>StandardErrorPath</key>
  <string>${PROJECT_DIR}/logs/frontend-error.log</string>
</dict>
</plist>
PLISTEOF

# === Agent 3: Cloudflare Tunnel ===
cat > "$LAUNCH_DIR/ai.theaidoc.medtranslate-tunnel.plist" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.theaidoc.medtranslate-tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/cloudflared</string>
    <string>tunnel</string>
    <string>run</string>
    <string>${TUNNEL_NAME}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${PROJECT_DIR}/logs/tunnel.log</string>
  <key>StandardErrorPath</key>
  <string>${PROJECT_DIR}/logs/tunnel-error.log</string>
</dict>
</plist>
PLISTEOF

# Load all agents
launchctl load "$LAUNCH_DIR/ai.theaidoc.medtranslate-backend.plist" 2>/dev/null
launchctl load "$LAUNCH_DIR/ai.theaidoc.medtranslate-frontend.plist" 2>/dev/null
launchctl load "$LAUNCH_DIR/ai.theaidoc.medtranslate-tunnel.plist" 2>/dev/null

echo "✅ All 3 services registered to auto-start on boot!"

# ── Done ──
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ✅  FULLY SET UP — ZERO DAILY EFFORT              ║"
echo "║                                                      ║"
echo "║   🌐  https://${SUBDOMAIN}.${DOMAIN}                 ║"
echo "║                                                      ║"
echo "║   Services auto-start when your Mac boots.           ║"
echo "║   Auto-restart if they crash.                        ║"
echo "║   Just leave your Mac on. That's it.                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "   To check status:  ./status.sh"
echo "   To stop all:      ./stop.sh"
echo ""
