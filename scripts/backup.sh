#!/usr/bin/env bash
# Respaldo automático de la base de datos del hotel (24/7).
# - Volcado comprimido diario en local.
# - Retención local configurable.
# - Copia offsite si se define CYHOTEL_OFFSITE (rsync a VPS / nube / otro host).
set -uo pipefail

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

BACKUP_DIR=/home/CyHotel/backups
RETENTION_DAYS=${CYHOTEL_BACKUP_RETENTION:-7}
LOG=/home/CyHotel/logs/backup.log
DB_CONTAINER=cyhotel-db
DOCKER=/usr/bin/docker
OFFSITE=${CYHOTEL_OFFSITE:-}

ts=$(date +%Y%m%d_%H%M)
out="$BACKUP_DIR/cyhotel_$ts.sql.gz"
mkdir -p "$BACKUP_DIR"

echo "[$(date)] backup inicio" >> "$LOG"

if $DOCKER exec "$DB_CONTAINER" pg_dump -U cyhotel cyhotel 2>>"$LOG" | gzip > "$out"; then
  echo "[$(date)] backup OK $out ($(du -h "$out" | cut -f1))" >> "$LOG"
else
  echo "[$(date)] backup FALLO" >> "$LOG"
fi

# Retención local
find "$BACKUP_DIR" -name 'cyhotel_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

# Copia offsite (VPS / nube) si está configurado
if [ -n "$OFFSITE" ]; then
  if rsync -az "$out" "$OFFSITE/" >>"$LOG" 2>&1; then
    echo "[$(date)] offsite OK -> $OFFSITE" >> "$LOG"
  else
    echo "[$(date)] offsite FALLO -> $OFFSITE" >> "$LOG"
  fi
fi
