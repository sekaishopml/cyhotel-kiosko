"""Config central — extrae ENV y constantes de server.py (Fase 2)."""
import os

APP_MODE = os.environ.get("APP_MODE", "kiosco")
HOTEL_ID_ENV = os.environ.get("HOTEL_ID", "1")

# DB
PG_HOST = os.environ.get("PGHOST", "localhost")
PG_PORT = int(os.environ.get("PGPORT", "5432"))
PG_USER = os.environ.get("PGUSER", "postgres")
PG_PASSWORD = os.environ.get("PGPASSWORD", "postgres")
PG_DATABASE = os.environ.get("PGDATABASE", "cyhotel")
APP_DB_USER = os.environ.get("CYHOTEL_DB_USER", "cyhotel_app")
APP_DB_PASSWORD = os.environ.get("CYHOTEL_DB_PASSWORD", "cyhotel_app")

# Auth
TOKEN_TTL_HOURS = 12
PBKDF2_ITERATIONS = 100_000
PBKDF2_SALT_PREFIX = "cyhotel::"

# Worker
WORKER_INTERVAL = 35
HOLD_MINUTES = 30
DEADLOCK_RETRIES = 3
DEADLOCK_BACKOFF_MS = [50, 150, 350]

# Kiosco defaults
AMANECIDA_ENTRY = "18:00"
AMANECIDA_EXIT = "09:00"
