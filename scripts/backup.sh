#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=/var/backups/cyhotel
DEPLOY_DIR=/home/CyHotel
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

docker exec cyhotel-db pg_dump -U cyhotel cyhotel 2>/dev/null | gzip > "$BACKUP_DIR/cyhotel_$(date +%Y%m%d_%H%M).sql.gz"

find "$BACKUP_DIR" -name 'cyhotel_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
