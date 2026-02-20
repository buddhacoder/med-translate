#!/bin/bash
# ===========================================================
# MedTranslate — Daily Startup (run before leaving for work)
# Launches: Backend + Frontend + Cloudflare Tunnel
# URL: https://translate.theaidoc.ai
# ===========================================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "�� Starting MedTranslate..."
echo "   URL: https://translate.theaidoc.ai"
echo ""

# Kill any previous instances
pkill -f "uvicorn app.main:app" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "cloudflared tunnel run" 2>/dev/null
sleep 1

# ── 1. FastAPI Backend ──
echo "🔧 Starting backend server..."
cd "$PROJECT_DIR/server"
source venv/bin/activate 2>/dev/null || true
uvicorn app.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# ── 2. Vite Frontend ──
echo "🌐 Starting frontend..."
cd "$PROJECT_DIR/client"
npx vite --host 0.0.0.0 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

sleep 3

# ── 3. Cloudflare Tunnel ──
echo "🚇 Starting Cloudflare tunnel..."
cloudflared tunnel run medtranslate &
TUNNEL_PID=$!
echo "   Tunnel PID: $TUNNEL_PID"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ✅  ALL SERVICES RUNNING                          ║"
echo "║                                                      ║"
echo "║   🌐  https://translate.theaidoc.ai                  ║"
echo "║                                                      ║"
echo "║   Press Ctrl+C to stop everything                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Wait and handle Ctrl+C gracefully
trap "echo ''; echo '🛑 Shutting down...'; kill $BACKEND_PID $FRONTEND_PID $TUNNEL_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait
