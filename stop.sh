#!/bin/bash
echo "🛑 Stopping MedTranslate services..."
LAUNCH_DIR="$HOME/Library/LaunchAgents"
for svc in backend frontend tunnel; do
  launchctl unload "$LAUNCH_DIR/ai.theaidoc.medtranslate-${svc}.plist" 2>/dev/null
  echo "  ⏹  ${svc} stopped"
done
echo "✅ All stopped. Run ./start.sh or reboot to restart."
