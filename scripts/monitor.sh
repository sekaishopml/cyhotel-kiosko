#!/usr/bin/env bash
# Monitoreo ligero del kiosco: consulta /api/health y alerta si cae.
# Configurable vía variables de entorno:
#   CYHOTEL_HEALTH_URL       (def: http://localhost:8000/api/health)
#   CYHOTEL_ALERT_WEBHOOK    URL que recibe POST {"text": "..."} (Telegram/Slack/etc.)
set -uo pipefail

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

URL=${CYHOTEL_HEALTH_URL:-http://localhost:8000/api/health}
WEBHOOK=${CYHOTEL_ALERT_WEBHOOK:-}
LOG=/home/CyHotel/logs/monitor.log
STATE=/home/CyHotel/logs/monitor.state

code=$(curl -s -o /tmp/.cyhotel_health.json -w '%{http_code}' -m 8 "$URL" 2>/dev/null || echo 000)

if [ "$code" = "200" ]; then
  echo "[$(date)] OK" >> "$LOG"
  echo "ok" > "$STATE"
  exit 0
fi

msg="ALERTA: kiosco no saludable (HTTP $code) en $(hostname) $(date)"
echo "[$(date)] $msg" >> "$LOG"

# Evita alertas repetitivas: solo avisa si antes estaba OK.
prev=$(cat "$STATE" 2>/dev/null || echo "ok")
if [ "$prev" = "ok" ] && [ -n "$WEBHOOK" ]; then
  curl -s -m 8 -X POST "$WEBHOOK" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"$msg\"}" >/dev/null 2>&1 || true
fi
echo "down" > "$STATE"
