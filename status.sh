#!/bin/bash
echo ""
echo "📊 MedTranslate Service Status"
echo "─────────────────────────────────"
for svc in backend frontend tunnel; do
  STATUS=$(launchctl list | grep "medtranslate-${svc}" | awk '{print $1}')
  if [ -n "$STATUS" ]; then
    if [ "$STATUS" = "-" ] || [ "$STATUS" = "0" ]; then
      echo "  ✅ ${svc}: running"
    else
      echo "  ❌ ${svc}: error (code: $STATUS)"
    fi
  else
    echo "  ⚫ ${svc}: not loaded"
  fi
done
echo ""
