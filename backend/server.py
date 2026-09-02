"""API multi-modo (kiosco/admin/master) sobre PostgreSQL multi-tenant; cada conexión aplica RLS vía set_app_hotel()."""

import json
import math
import os
import secrets
import socket
import threading
import time
from datetime import datetime, timedelta
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from queue import Queue, Empty
from urllib.parse import urlparse, unquote, parse_qs
from zoneinfo import ZoneInfo

try:
    from psycopg2 import errors as _pg_errors
except Exception:  # pragma: no cover - entorno sin psycopg2 (solo lint)
    _pg_errors = None

# DATABASE_URL -> variables que lee db.py (debe ir antes del import).
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://cyhotel_app:cyhotel_app@localhost:5432/cyhotel"
)
_parsed = urlparse(DATABASE_URL)
os.environ["PGHOST"] = _parsed.hostname or "localhost"
os.environ["PGPORT"] = str(_parsed.port or 5432)
os.environ["PGDATABASE"] = (_parsed.path or "/cyhotel").lstrip("/") or "cyhotel"
if _parsed.username:
    os.environ["PGUSER"] = _parsed.username
    if _parsed.password:
        os.environ["PGPASSWORD"] = _parsed.password
# El rol de app solo se sobrescribe si la URL trae 'cyhotel_app'; en docker trae superusuario (evade RLS).
if _parsed.username and _parsed.username == "cyhotel_app":
    os.environ["CYHOTEL_DB_USER"] = _parsed.username
    if _parsed.password:
        os.environ["CYHOTEL_DB_PASSWORD"] = _parsed.password

from db import (  # noqa: E402
    db, release_conn, set_app_hotel, init_db, verify_password,
    exec as db_exec, fetch_one, fetch_all,
    ROOM_TYPES, AMANECIDA_ENTRY, AMANECIDA_EXIT, HOLD_MINUTES,
)
from worker import worker_loop  # noqa: E402

# Fase 2: servicios extraídos (después de db para que env esté listo)
try:
    from app.services.pricing import apply_price_override as _svc_apply_price
    from app.services.pricing import suite_subtotal as _svc_suite_subtotal
    from app.services import auth as _auth_svc
except Exception as _e:
    print(f"[init] Fase2 services import fail: {_e}", flush=True)
    _svc_apply_price = None
    _svc_suite_subtotal = None
    _auth_svc = None

# Reintento con backoff ante deadlock/serialización; la transacción se re-ejecuta completa.
DEADLOCK_RETRIES = 3
DEADLOCK_BACKOFF_MS = [0.05, 0.15, 0.35]


def _is_retryable_pg(exc):
    if _pg_errors is None:
        return False
    try:
        return isinstance(exc, (_pg_errors.DeadlockDetected, _pg_errors.SerializationFailure))
    except Exception:
        return False

ECUADOR_TZ = ZoneInfo("America/Guayaquil")

APP_MODE = os.environ.get("APP_MODE", "admin").strip().lower()
if APP_MODE not in ("kiosco", "admin", "master"):
    APP_MODE = "admin"
PORT = int(os.environ.get("PORT", "8000"))

_hotel_env = os.environ.get("HOTEL_ID", "") or ""
HOTEL_ID = None
if _hotel_env.strip():
    try:
        HOTEL_ID = int(_hotel_env)
    except ValueError:
        HOTEL_ID = None
if APP_MODE != "master" and HOTEL_ID is None:
    HOTEL_ID = 1

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "storage"))
WEB_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "web"))
WEB_MASTER_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "web-master"))
ROOMS_PHOTO_DIR = os.path.join(STORAGE_DIR, "rooms")

TOKEN_TTL = timedelta(hours=12)
WORKER_INTERVAL = int(os.environ.get("WORKER_INTERVAL", "35"))
PAY_DEDUPE_SECONDS = 5

ROLES_PAY = ("recepcion", "gerencia")
ROLES_ORDERS = ("recepcion", "gerencia")
ROLES_ROOMS = ("recepcion", "housekeeping", "gerencia")
ROLES_ROOM_STATUS = ("housekeeping", "gerencia")
ROLES_AUDIT = ("gerencia",)
ROLES_OVERVIEW = ("recepcion", "gerencia")
ROLES_OCCUPANCY = ("housekeeping", "recepcion", "gerencia")
ROLES_HOUSEKEEPING = ("housekeeping", "gerencia")
ROLES_INCIDENCES = ("housekeeping", "gerencia")
# Recepción también ve la cola de limpieza porque asigna personal.
ROLES_STAFF = ("recepcion", "housekeeping", "gerencia")
ROLES_SETTINGS_GET = ("recepcion", "gerencia")
ROLES_SETTINGS_POST = ("gerencia",)

ORDER_STATUSES = ("por_asignar", "pendiente", "pagado", "confirmada", "finalizada", "vencida", "anulado")
ORDER_PRODUCTS = ("momento", "amanecida", "hospedaje", "suite", "reserva")
CLEANING_STATUSES = ("pendiente", "en_proceso", "pausada", "completada", "incidencia")
INCIDENCE_STATUSES = ("abierta", "resuelta")

PRODUCT_LABELS = {
    "momento": "Momento",
    "amanecida": "Amanecida",
    "hospedaje": "Hospedaje",
    "suite": "Suite",
    "reserva": "Reserva",
}

EXTEND_OPTIONS = {
    "1h": (1, 5.0),
    "6h": (6, 20.0),
}

ACTIVITY_LABELS = {
    "login_ok": "Inicio de sesión",
    "login_fail": "Intento de login fallido",
    "crear_orden": "Nueva orden",
    "crear_reserva": "Nueva reserva",
    "asignar_habitacion": "Habitación asignada",
    "confirmar_pago": "Pago confirmado",
    "checkout": "Checkout",
    "anular_orden": "Orden anulada",
    "extender_estadia": "Extensión de estadía",
    "actualizar_config": "Configuración actualizada",
    "liberacion_automatica": "Salida automática",
    "orden_vencida": "Orden vencida",
    "reserva_expirada": "Reserva expirada",
    "cambiar_estado_cuarto": "Cambio de estado de habitación",
    "housekeeping_start": "Limpieza iniciada",
    "housekeeping_complete": "Limpieza completada",
    "housekeeping_incident": "Incidencia de limpieza",
    "incidencia_resuelta": "Incidencia resuelta",
    "crear_personal": "Personal de limpieza creado/reactivado",
    "desactivar_personal": "Personal de limpieza desactivado",
    "asignar_personal": "Personal asignado",
}

# Sesiones: {token: {username, role, hotel_id, scope, expires}}; scope 'hotel' o 'master'.
sessions = {}

# Broadcast SSE global de eventos en tiempo real.
SSE_CLIENTS = set()
SSE_LOCK = threading.Lock()

# Canal pg_notify entre procesos: el kiosco notifica y admin/master re-emiten a sus clientes SSE.
PG_NOTIFY_CHANNEL = "cyhotel_changed"

# Caché en memoria del APK: se lee del disco una sola vez y se sirve desde RAM en cada
# descarga de actualización (evita I/O de disco por request y maximiza la velocidad de envío).
_APK_CACHE = {"path": None, "mtime": 0.0, "bytes": None}


def pg_notify_change(conn, event_type, data=None):
    """NOTIFY dentro de la transacción actual (se entrega en COMMIT)."""
    payload = json.dumps({"type": event_type, "data": data or {}}, ensure_ascii=False)
    try:
        db_exec(conn, "SELECT pg_notify(%s, %s)", (PG_NOTIFY_CHANNEL, payload))
    except Exception:
        pass


def sse_broadcast(event_type, data=None):
    payload = json.dumps({"type": event_type, "data": data or {}}, ensure_ascii=False)
    with SSE_LOCK:
        for q in list(SSE_CLIENTS):
            try:
                q.put_nowait(payload)
            except Exception:
                pass


def sse_add_client():
    q = Queue(maxsize=200)
    with SSE_LOCK:
        SSE_CLIENTS.add(q)
    return q


def sse_remove_client(q):
    with SSE_LOCK:
        SSE_CLIENTS.discard(q)


def notify_listener_loop():
    """Escucha LISTEN PG_NOTIFY_CHANNEL y re-emite a los clientes SSE locales (llega sin polling)."""
    try:
        import select
    except Exception:
        return
    while True:
        conn = None
        try:
            conn = db()
            conn.autocommit = True
            set_app_hotel(conn, "master")
            cur = conn.cursor()
            cur.execute("LISTEN %s" % PG_NOTIFY_CHANNEL)
            print(f"[notify] escuchando canal {PG_NOTIFY_CHANNEL}", flush=True)
            while True:
                if select.select([conn], [], [], 10) == ([], [], []):
                    continue
                conn.poll()
                while conn.notifies:
                    n = conn.notifies.pop(0)
                    try:
                        msg = json.loads(n.payload)
                    except Exception:
                        continue
                    sse_broadcast(msg.get("type", "data_changed"), msg.get("data", {}))
        except Exception as e:
            print(f"[notify] error: {e}", flush=True)
            time.sleep(3)
        finally:
            try:
                if conn is not None:
                    release_conn(conn)
            except Exception:
                pass


def now():
    return datetime.now(ECUADOR_TZ)


def local_str(dt):
    """'YYYY-MM-DD HH:MM' local para las fechas de las respuestas."""
    if dt is None:
        return None
    return dt.astimezone(ECUADOR_TZ).strftime("%Y-%m-%d %H:%M")


def show_fmt(dt):
    """'dd/mm/aaaa HH:MM' para los campos *_fmt."""
    if dt is None:
        return None
    return dt.astimezone(ECUADOR_TZ).strftime("%d/%m/%Y %H:%M")


def num(v):
    """Decimal (NUMERIC/AVG/SUM de PostgreSQL) -> float para JSON."""
    if isinstance(v, Decimal):
        return float(v)
    return v


def parse_date_local(value, name):
    """Valida YYYY-MM-DD y devuelve datetime aware (medianoche local)."""
    try:
        d = datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValueError(f"{name} debe tener formato YYYY-MM-DD")
    return datetime(d.year, d.month, d.day, tzinfo=ECUADOR_TZ)


def audit(conn, hotel_id, action, order_id, room_id, staff_user, details):
    db_exec(
        conn,
        "INSERT INTO audit_log (hotel_id, action, order_id, room_id, staff_user, details) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (hotel_id, action, order_id, room_id, staff_user, details),
    )


def room_history(conn, room_id, status):
    db_exec(
        conn,
        "INSERT INTO room_status_history (hotel_id, room_id, status) "
        "VALUES ((SELECT current_hotel_id()), %s, %s)",
        (room_id, status),
    )


class Handler(BaseHTTPRequestHandler):
    server_version = "CyHotelMultiTenant/2.0"

    MODE = APP_MODE
    HOTEL = HOTEL_ID

    def setup(self):
        super().setup()
        try:
            self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except Exception:
            pass

    def _send(self, code, payload):
        body = json.dumps(
            payload, ensure_ascii=False, default=lambda o: float(o) if isinstance(o, Decimal) else str(o)
        ).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, code, message):
        self._send(code, {"error": message})

    def _body(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            raise ValueError("JSON inválido")

    def _qs(self):
        return parse_qs(urlparse(self.path).query)

    def _bearer_token(self):
        header = self.headers.get("Authorization") or ""
        if header.startswith("Bearer "):
            return header[len("Bearer "):].strip()
        return ""

    def _require_auth(self, roles=None, scope=None):
        header = self.headers.get("Authorization") or ""
        token = header[len("Bearer "):].strip() if header.startswith("Bearer ") else ""
        if _auth_svc:
            sess = _auth_svc.get_session(token)
        else:
            sess = sessions.get(token)
            if sess and sess["expires"] < now():
                sessions.pop(token, None)
                sess = None
        if not sess:
            self._error(401, "Se requiere un token válido (Authorization: Bearer ...)")
            return None
        if scope and sess.get("scope") != scope:
            self._error(403, f"El token no tiene alcance '{scope}'")
            return None
        if roles and sess["role"] not in roles:
            self._error(403, f"El rol '{sess['role']}' no tiene permisos para esta acción")
            return None
        return sess

    def _conn(self, sess=None, master=False):
        """Conexión con RLS activado: hotel de la sesión, o 'master'."""
        conn = db()
        if master or self.MODE == "master":
            set_app_hotel(conn, "master")
        else:
            hid = sess.get("hotel_id") if sess else self.HOTEL
            set_app_hotel(conn, hid)
        return conn

    def _hotel_id(self, sess=None):
        if self.MODE == "master":
            return None
        if sess is not None:
            return sess.get("hotel_id") or self.HOTEL
        return self.HOTEL

    def _slug_for(self, hotel_id):
        conn = db()
        set_app_hotel(conn, hotel_id)
        try:
            row = fetch_one(conn, "SELECT slug FROM hotels WHERE id = %s", (hotel_id,))
            return row["slug"] if row else None
        finally:
            release_conn(conn)

    def _static_map(self):
        if self.MODE == "kiosco":
            return {"/": "kiosco/dist/index.html", "/kiosco": "kiosco/dist/index.html", "/kiosco.apk": "kiosco.apk"}
        if self.MODE == "master":
            return {"/": "master.html", "/master": "master.html"}
        return {
            "/": "admin.html",
            "/admin": "admin.html",
            "/dashboard": "admin.html",
            "/kiosco": "kiosco.html",
        }

    def get_events(self):
        qs = self._qs()
        token = (qs.get("token") or [""])[0]
        if _auth_svc:
            sess = _auth_svc.get_session(token)
        else:
            sess = sessions.get(token)
            if sess and sess["expires"] < now():
                sessions.pop(token, None)
                sess = None
        if not sess:
            self._error(401, "Token inválido o expirado")
            return
        q = sse_add_client()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        try:
            self.wfile.write(b": conectado\n\n")
            self.wfile.flush()
            while True:
                try:
                    msg = q.get(timeout=30)
                    self.wfile.write(b"data: " + msg.encode("utf-8") + b"\n\n")
                    self.wfile.flush()
                except Empty:
                    # Keep-alive: comentario ': ping' cada ~30s para que los
                    # proxies/proxies no corten la conexión SSE.
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        finally:
            sse_remove_client(q)

    def do_GET(self):
        path = unquote(urlparse(self.path).path).rstrip("/") or "/"
        # Redirige /kiosco -> /kiosco/ para que las rutas relativas del build
        # (base "./") resuelvan correctamente bajo /kiosco/.
        if urlparse(self.path).path == "/kiosco":
            self.send_response(302)
            self.send_header("Location", "/kiosco/")
            self.end_headers()
            return
        try:
            if path == "/api/health":
                self.api_health()
                return
            if path == "/api/events":
                if self.MODE == "kiosco":
                    self._error(404, "Ruta no encontrada")
                    return
                self.get_events()
            elif path == "/api/catalog" and self.MODE in ("kiosco", "admin"):
                self.get_catalog()
            elif path == "/api/types" and self.MODE in ("kiosco", "admin"):
                self.get_types()
            elif path == "/api/kiosco-version":
                self.kiosco_version()
            elif path == "/api/kiosco-update":
                self.kiosco_update()
            elif path == "/api/kiosco-config":
                self.kiosco_config()
            elif path == "/api/docs.yaml":
                self.serve_openapi()
            elif path == "/api/admin/me":
                sess = self._require_auth()
                if sess:
                    self.admin_me(sess)
            elif path == "/api/master/hotels":
                if not self._master_auth():
                    return
                self.master_hotels()
            elif path == "/api/master/dashboard":
                if not self._master_auth():
                    return
                self.master_dashboard()
            elif path == "/api/master/orders":
                if not self._master_auth():
                    return
                self.master_orders()
            elif self.MODE == "admin" and path == "/api/rooms":
                if not self._require_auth(ROLES_ROOMS, "hotel"):
                    return
                self.get_rooms()
            elif self.MODE == "admin" and path == "/api/rooms/available":
                if not self._require_auth(ROLES_ROOMS, "hotel"):
                    return
                self.get_rooms_available()
            elif self.MODE == "admin" and path == "/api/orders":
                if not self._require_auth(ROLES_ORDERS, "hotel"):
                    return
                self.get_orders()
            elif self.MODE == "admin" and path.startswith("/api/orders/"):
                if not self._require_auth(ROLES_ORDERS, "hotel"):
                    return
                self.get_order_detail(path)
            elif self.MODE == "admin" and path == "/api/reservations":
                if not self._require_auth(ROLES_ORDERS, "hotel"):
                    return
                self.get_reservations()
            elif self.MODE == "admin" and path == "/api/audit":
                if not self._require_auth(ROLES_AUDIT, "hotel"):
                    return
                self.get_audit()
            elif self.MODE == "admin" and path == "/api/dashboard/overview":
                if not self._require_auth(ROLES_OVERVIEW, "hotel"):
                    return
                self.dashboard_overview()
            elif self.MODE == "admin" and path == "/api/dashboard/occupancy":
                if not self._require_auth(ROLES_OCCUPANCY, "hotel"):
                    return
                self.dashboard_occupancy()
            elif self.MODE == "admin" and path == "/api/dashboard/close-report":
                if not self._require_auth(ROLES_OVERVIEW, "hotel"):
                    return
                self.close_report()
            elif self.MODE == "admin" and path == "/api/dashboard/daily-report":
                if not self._require_auth(ROLES_AUDIT, "hotel"):
                    return
                self.daily_report()
            elif self.MODE == "admin" and path == "/api/dashboard/alerts":
                if not self._require_auth(scope="hotel"):
                    return
                self.dashboard_alerts()
            elif self.MODE == "admin" and path == "/api/hotel/settings":
                if not self._require_auth(ROLES_SETTINGS_GET, "hotel"):
                    return
                self.get_settings()
            elif self.MODE == "admin" and path == "/api/housekeeping/tasks":
                # Recepción también ve la cola de limpieza porque asigna personal (ROLES_STAFF).
                if not self._require_auth(ROLES_STAFF, "hotel"):
                    return
                self.get_housekeeping_tasks()
            elif self.MODE == "admin" and path == "/api/housekeeping/staff":
                if not self._require_auth(ROLES_STAFF, "hotel"):
                    return
                self.get_housekeeping_staff()
            elif self.MODE == "admin" and path == "/api/incidences":
                if not self._require_auth(ROLES_INCIDENCES, "hotel"):
                    return
                self.get_incidences()
            elif path.startswith("/uploads/"):
                self._serve_upload(path)
            elif path.startswith("/img/"):
                self._serve_img(path)
            elif path.startswith("/kiosco/"):
                self._serve_react_spa(path)
            elif path in self._static_map():
                self._serve_static(path)
            else:
                self._error(404, "Ruta no encontrada")
        except ValueError as e:
            self._error(400, str(e))
        except Exception as e:
            self._error(500, str(e))

    def _master_auth(self):
        if self.MODE != "master":
            self._error(404, "Ruta no encontrada")
            return None
        return self._require_auth(scope="master")

    def do_POST(self):
        path = unquote(urlparse(self.path).path).rstrip("/") or "/"
        # Rutas que mutan filas críticas: se reintentan ante deadlock de PostgreSQL.
        critical = (
            self.MODE == "admin" and (
                path.endswith("/assign") or path.endswith("/pay") or path.endswith("/cancel")
                or path.endswith("/checkout") or path.endswith("/extend")
                or (path.startswith("/api/rooms/") and path.endswith("/status"))
                or path.startswith("/api/housekeeping/tasks/")
                or path.startswith("/api/incidences/")
            )
        )
        attempts = DEADLOCK_RETRIES if critical else 1
        last_exc = None
        for attempt in range(attempts):
            try:
                data = self._body()
                if path == "/api/admin/login" and self.MODE in ("admin", "master"):
                    self.admin_login(data)
                elif path == "/api/admin/pin-login" and self.MODE in ("admin", "master"):
                    self.admin_pin_login(data)
                elif path == "/api/admin/logout" and self.MODE in ("admin", "master"):
                    if not self._require_auth():
                        return
                    self.admin_logout()
                elif path == "/api/orders" and self.MODE in ("kiosco", "admin"):
                    self.create_order(data)
                elif self.MODE == "admin" and path.startswith("/api/orders/") and path.endswith("/assign"):
                    sess = self._require_auth(ROLES_PAY, "hotel")
                    if not sess:
                        return
                    self.assign_order(path, data, sess)
                elif self.MODE == "admin" and path.startswith("/api/orders/") and path.endswith("/pay"):
                    sess = self._require_auth(ROLES_PAY, "hotel")
                    if not sess:
                        return
                    self.pay_order(path, data, sess)
                elif self.MODE == "admin" and path.startswith("/api/orders/") and path.endswith("/cancel"):
                    sess = self._require_auth(ROLES_PAY, "hotel")
                    if not sess:
                        return
                    self.cancel_order(path, data, sess)
                elif self.MODE == "admin" and path.startswith("/api/orders/") and path.endswith("/checkout"):
                    sess = self._require_auth(ROLES_PAY, "hotel")
                    if not sess:
                        return
                    self.checkout_order(path, sess)
                elif self.MODE == "admin" and path.startswith("/api/orders/") and path.endswith("/extend"):
                    sess = self._require_auth(ROLES_PAY, "hotel")
                    if not sess:
                        return
                    self.extend_order(path, data, sess)
                elif self.MODE == "admin" and path.startswith("/api/rooms/") and path.endswith("/status"):
                    sess = self._require_auth(ROLES_ROOM_STATUS, "hotel")
                    if not sess:
                        return
                    self.set_room_status(path, data, sess)
                elif self.MODE == "admin" and path.startswith("/api/housekeeping/tasks/") and path.endswith("/start"):
                    sess = self._require_auth(ROLES_HOUSEKEEPING, "hotel")
                    if not sess:
                        return
                    self.housekeeping_start(path, sess)
                elif self.MODE == "admin" and path.startswith("/api/housekeeping/tasks/") and path.endswith("/assign-staff"):
                    sess = self._require_auth(ROLES_STAFF, "hotel")
                    if not sess:
                        return
                    self.assign_staff_to_task(path, data, sess)
                elif self.MODE == "admin" and path == "/api/housekeeping/staff":
                    sess = self._require_auth(ROLES_STAFF, "hotel")
                    if not sess:
                        return
                    self.create_housekeeping_staff(data, sess)
                elif self.MODE == "admin" and path.startswith("/api/housekeeping/staff/") and path.endswith("/deactivate"):
                    sess = self._require_auth(ROLES_STAFF, "hotel")
                    if not sess:
                        return
                    self.deactivate_housekeeping_staff(path, sess)
                elif self.MODE == "admin" and path.startswith("/api/housekeeping/tasks/") and path.endswith("/complete"):
                    sess = self._require_auth(ROLES_HOUSEKEEPING, "hotel")
                    if not sess:
                        return
                    self.housekeeping_complete(path, sess)
                elif self.MODE == "admin" and path.startswith("/api/housekeeping/tasks/") and path.endswith("/incident"):
                    sess = self._require_auth(ROLES_HOUSEKEEPING, "hotel")
                    if not sess:
                        return
                    self.housekeeping_incident(path, data, sess)
                elif self.MODE == "admin" and path.startswith("/api/incidences/") and path.endswith("/resolve"):
                    sess = self._require_auth(ROLES_INCIDENCES, "hotel")
                    if not sess:
                        return
                    self.resolve_incidence(path, sess)
                elif self.MODE == "admin" and path == "/api/hotel/settings":
                    sess = self._require_auth(ROLES_SETTINGS_POST, "hotel")
                    if not sess:
                        return
                    self.post_settings(data, sess)
                elif path == "/api/kiosco-crash":
                    self.kiosco_crash(data)
                else:
                    self._error(404, "Ruta no encontrada")
                return
            except ValueError as e:
                self._error(400, str(e))
                return
            except Exception as e:
                if _is_retryable_pg(e) and attempt < attempts - 1:
                    last_exc = e
                    time.sleep(DEADLOCK_BACKOFF_MS[min(attempt, len(DEADLOCK_BACKOFF_MS) - 1)])
                    continue
                self._error(500, str(e))
                return
        if last_exc is not None:
            self._error(500, f"Concurrencia en base de datos: {last_exc}")

    def admin_login(self, data):
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        conn = self._conn(master=(self.MODE == "master"))
        try:
            if self.MODE == "master":
                user = fetch_one(
                    conn,
                    "SELECT * FROM users WHERE hotel_id IS NULL AND username = %s AND role = 'master'",
                    (username,),
                )
                hotel_id = None
                scope = "master"
            else:
                user = fetch_one(
                    conn, "SELECT * FROM users WHERE hotel_id = %s AND username = %s",
                    (self.HOTEL, username),
                )
                hotel_id = self.HOTEL
                scope = "hotel"
            if not user or not verify_password(password, username, user["password_hash"]):
                audit(conn, hotel_id, "login_fail", None, None, username or "anónimo",
                      "Intento de login fallido")
                conn.commit()
                self._error(401, "Usuario o contraseña incorrectos")
                return
            if _auth_svc:
                token, _ = _auth_svc.create_session(None, user["username"], user["role"], hotel_id, scope)
            else:
                token = secrets.token_hex(32)
                sessions[token] = {
                    "username": user["username"],
                    "role": user["role"],
                    "hotel_id": hotel_id,
                    "scope": scope,
                    "expires": now() + TOKEN_TTL,
                }
            audit(conn, hotel_id, "login_ok", None, None, user["username"],
                  f"Login exitoso como {user['role']}")
            conn.commit()
            self._send(200, {
                "token": token,
                "username": user["username"],
                "role": user["role"],
                "scope": scope,
            })
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)

    def admin_pin_login(self, data):
        pin = (data.get("pin") or "").strip()
        admin_pin = os.environ.get("CYHOTEL_ADMIN_PIN", "12345")
        if pin != admin_pin:
            self._error(401, "PIN incorrecto")
            return
        if _auth_svc:
            token, _ = _auth_svc.create_session(None, "admin", "gerencia", self.HOTEL, "hotel")
        else:
            token = secrets.token_hex(32)
            sessions[token] = {
                "username": "admin",
                "role": "gerencia",
                "hotel_id": self.HOTEL,
                "scope": "hotel",
                "expires": now() + TOKEN_TTL,
            }
        self._send(200, {
            "token": token,
            "username": "admin",
            "role": "gerencia",
            "scope": "hotel",
        })

    def admin_logout(self):
        token = self._bearer_token()
        if _auth_svc:
            sess = _auth_svc.get_session(token)
        else:
            sess = sessions.get(token)
        username = sess["username"] if sess else "anónimo"
        conn = self._conn(sess=sess, master=bool(sess and sess.get("scope") == "master"))
        try:
            audit(conn, self._hotel_id(sess), "logout", None, None, username, "Cierre de sesión")
            conn.commit()
        except Exception:
            conn.rollback()
        finally:
            release_conn(conn)
        if _auth_svc:
            _auth_svc.delete_session(token)
        else:
            sessions.pop(token, None)
        self._send(200, {"ok": True, "message": "Sesión cerrada"})

    def admin_me(self, sess):
        self._send(200, {
            "username": sess["username"],
            "role": sess["role"],
            "scope": sess.get("scope", "hotel"),
        })

    def get_catalog(self):
        self._send(200, {
            "types": ROOM_TYPES,
            "amanecida_entry": AMANECIDA_ENTRY,
            "amanecida_exit": AMANECIDA_EXIT,
        })

    def _price_overrides(self):
        """Lee price_overrides del config del hotel (dict). Devuelve {} si no hay.

        Estructuras soportadas (ambas se normalizan al segundo estilo):
          {'momento': {'estandar': 8}, 'extras': {'doble': {'1h': 6}}}
          {'estandar': {'price': 8, 'extras': {'1h': 6}}}
        """
        try:
            conn = self._conn()
            try:
                cfg = self._hotel_config(conn, self.HOTEL)
            finally:
                release_conn(conn)
        except Exception:
            return {}
        kiosco = cfg.get("kiosco")
        kiosco = kiosco if isinstance(kiosco, dict) else {}
        po = kiosco.get("price_overrides") if "price_overrides" in kiosco else cfg.get("price_overrides")
        if not isinstance(po, dict):
            return {}
        return po

    def _apply_price_override(self, overrides, key, default_price, extra_key=None):
        """Devuelve el precio ajustado según overrides; si la estructura es rara,
        devuelve el default sin romper."""
        if _svc_apply_price:
            try:
                return _svc_apply_price(overrides, key, default_price, extra_key)
            except Exception:
                pass
        base = overrides.get(key)
        if extra_key is None:
            if isinstance(base, dict) and "price" in base:
                try:
                    return float(base["price"])
                except (TypeError, ValueError):
                    return default_price
            if isinstance(base, (int, float)):
                try:
                    return float(base)
                except (TypeError, ValueError):
                    return default_price
            return default_price
        if isinstance(base, dict):
            extras = base.get("extras")
        else:
            extras = None
        if isinstance(extras, dict) and extra_key in extras:
            val = extras.get(extra_key)
            if isinstance(val, (int, float)):
                try:
                    return float(val)
                except (TypeError, ValueError):
                    return default_price
        return default_price

    def get_types(self):
        product = self._query_product()
        overrides = self._price_overrides()
        conn = self._conn()
        try:
            free_by_type = {}
            for row in fetch_all(
                conn,
                "SELECT type, COUNT(*) AS n FROM rooms WHERE status = 'libre' GROUP BY type",
            ):
                free_by_type[row["type"]] = int(row["n"])
        finally:
            release_conn(conn)
        other_free = sum(n for t, n in free_by_type.items() if t in ("estandar", "matrimonial"))
        photo_for = lambda key: "/img/suite.jpeg" if key == "suite" else "/img/habitacion.jpeg"
        merge_am = product in ("amanecida", "hospedaje")
        result = []
        for key, info in ROOM_TYPES.items():
            if merge_am and key == "matrimonial":
                continue
            free = free_by_type.get(key, 0)
            if merge_am and key == "estandar":
                free = free_by_type.get("estandar", 0) + free_by_type.get("matrimonial", 0)
                info = {
                    **info,
                    "label": "Sencilla Matrimonial",
                    "desc": "Sencilla o matrimonial (la matrimonial es más amplia, con nevera y baño con mampara). A/C, TV Smart, WiFi, agua caliente, bebidas y piqueos",
                }
            if product == "reserva":
                result.append({
                    "key": key,
                    "label": info["label"],
                    "desc": info["desc"],
                    "photo": photo_for(key),
                    "price": None,
                    "free": free,
                    "eligible": free > 0,
                    "reason": None if free > 0 else "No hay habitaciones libres de este tipo",
                    "extras": {},
                })
                continue
            if product == "suite":
                if key == "suite":
                    price = info.get("momento")
                    price = self._apply_price_override(overrides, key, price)
                    _entry = info.get("amanecida_entry", AMANECIDA_ENTRY)
                    extras = {
                        "momento": {"label": "Momento (3h)", "price": info.get("momento", 0)},
                        "amanecida": {"label": f"Amanecida ({_entry}-{AMANECIDA_EXIT})", "price": info.get("amanecida", 0)},
                        "hospedaje": {"label": "Hospedaje (por noche)", "price": info.get("hospedaje", 0)},
                    }
                else:
                    price = None
                    extras = {}
            elif product in ("momento", "amanecida", "hospedaje") and key == "suite":
                price = None
                extras = {}
            else:
                price = info.get(product)
                price = self._apply_price_override(overrides, key, price)
                extras = {} if product == "amanecida" else (info.get("extras") or {})
                if isinstance(extras, dict):
                    extras = {ek: dict(ev) for ek, ev in extras.items()}
                    for ek, ev in extras.items():
                        ev["price"] = self._apply_price_override(
                            overrides, key, ev.get("price", 0), extra_key=ek
                        )
            if price is None:
                continue
            eligible, reason = True, None
            if product == "momento" and info.get("momento_solo_sin_otras"):
                eligible = free > 0 and other_free == 0
                if not eligible:
                    reason = "Solo se vende de momento cuando no hay otras habitaciones"
            elif free == 0:
                eligible, reason = False, "No hay habitaciones disponibles de este tipo"
            result.append({
                "key": key,
                "label": info["label"],
                "desc": info["desc"],
                "photo": photo_for(key),
                "price": price,
                "free": free,
                "eligible": eligible,
                "reason": reason,
                "extras": extras,
            })
        self._send(200, {"product": product, "types": result})

    def _query_product(self):
        qs = self._qs()
        product = (qs.get("product") or [""])[0]
        if product not in ORDER_PRODUCTS:
            raise ValueError("product inválido (momento, amanecida, hospedaje, suite, reserva)")
        return product

    def _photo_url(self, number, hotel_id):
        slug = None
        if hotel_id:
            slug = self._slug_for(hotel_id)
        if slug and os.path.isfile(os.path.join(STORAGE_DIR, slug, "rooms", f"{number}.jpg")):
            return f"/uploads/{slug}/rooms/{number}.jpg"
        if os.path.isfile(os.path.join(ROOMS_PHOTO_DIR, f"{number}.jpg")):
            return f"/uploads/rooms/{number}.jpg"
        return None

    def _room_dict(self, row, hotel_id):
        d = dict(row)
        info = ROOM_TYPES.get(d["type"]) or {}
        d["label"] = info.get("label", d["type"])
        d["photo"] = self._photo_url(d["number"], hotel_id)
        return d

    def get_rooms(self):
        conn = self._conn(master=False)
        try:
            rows = fetch_all(conn, "SELECT * FROM rooms ORDER BY id")
        finally:
            release_conn(conn)
        self._send(200, {"rooms": [self._room_dict(r, self.HOTEL) for r in rows]})

    def get_rooms_available(self):
        conn = self._conn()
        try:
            rows = fetch_all(conn, "SELECT * FROM rooms WHERE status = 'libre' ORDER BY id")
        finally:
            release_conn(conn)
        self._send(200, {"rooms": [self._room_dict(r, self.HOTEL) for r in rows]})

    ROOM_STATUS_TRANSITIONS = {
        "libre": ("en_limpieza", "bloqueado"),
        "en_limpieza": ("libre", "bloqueado"),
        "bloqueado": ("libre", "en_limpieza"),
    }

    def set_room_status(self, path, data, sess):
        room_id = int(path.split("/")[-2])
        status = (data.get("status") or "").strip()
        if status not in ("libre", "en_limpieza", "bloqueado"):
            raise ValueError("status debe ser: libre, en_limpieza o bloqueado")
        reason = data.get("reason")
        reason = reason.strip() if isinstance(reason, str) else ""
        if len(reason) > 200:
            raise ValueError("reason no puede superar los 200 caracteres")
        if status != "bloqueado":
            reason = ""
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            room = fetch_one(conn, "SELECT * FROM rooms WHERE id = %s FOR UPDATE", (room_id,))
            if not room:
                self._error(404, "Cuarto no encontrado")
                return
            old = room["status"]
            if old == "ocupado":
                raise ValueError("El cuarto está ocupado por una orden activa; use checkout o anule la orden primero")
            valid_targets = self.ROOM_STATUS_TRANSITIONS.get(old, ())
            if old == status or status not in valid_targets:
                raise ValueError(
                    f"Transición inválida: {old} -> {status}. "
                    f"Desde '{old}' las transiciones válidas son: {', '.join(valid_targets) or 'ninguna'}"
                )
            if old == "en_limpieza" and status == "libre":
                active = fetch_one(
                    conn,
                    "SELECT id FROM cleaning_tasks WHERE room_id = %s AND status IN ('pendiente', 'en_proceso', 'incidencia') ORDER BY id LIMIT 1",
                    (room_id,),
                )
                if active:
                    raise ValueError(
                        f"Hay una tarea de limpieza activa (#{active['id']}). Completela o marque incidencia antes de liberar la habitación"
                    )
            db_exec(conn, "UPDATE rooms SET status = %s WHERE id = %s", (status, room_id))
            room_history(conn, room_id, status)
            created_task = None
            if status == "en_limpieza":
                active = fetch_one(
                    conn,
                    "SELECT id FROM cleaning_tasks WHERE room_id = %s AND status IN ('pendiente', 'en_proceso', 'incidencia') ORDER BY id LIMIT 1",
                    (room_id,),
                )
                if not active:
                    db_exec(
                        conn,
                        "INSERT INTO cleaning_tasks (hotel_id, room_id, order_id, status) VALUES (%s, %s, NULL, 'pendiente') RETURNING id",
                        (hotel_id, room_id),
                    )
                    task_row = fetch_one(
                        conn,
                        "SELECT * FROM cleaning_tasks WHERE room_id = %s AND status = 'pendiente' AND order_id IS NULL ORDER BY id DESC LIMIT 1",
                        (room_id,),
                    )
                    if task_row:
                        created_task = self._cleaning_dict(conn, task_row)
            details = f"{room['number']}: {old} -> {status}"
            if reason:
                details += f" · motivo: {reason}"
            audit(conn, hotel_id, "cambiar_estado_cuarto", None, room_id, sess["username"], details)
            pg_notify_change(conn, "data_changed", {"type": "estado_cuarto", "room_id": room_id, "status": status})
            conn.commit()
            fresh = fetch_one(conn, "SELECT * FROM rooms WHERE id = %s", (room_id,))
            result = {"room": self._room_dict(fresh, hotel_id), "task": created_task, "reason": reason or None}
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("data_changed", {"type": "estado_cuarto", "room_id": room_id, "status": status})
        self._send(200, result)

    def _order_dict(self, conn, row):
        d = dict(row)
        d["subtotal"] = num(d.get("subtotal")) if d.get("subtotal") is not None else 0.0
        check_out_dt = row.get("check_out")
        d["remaining_seconds"] = max(0, int((check_out_dt - now()).total_seconds())) if check_out_dt else 0
        for key in ("check_in", "check_out", "created_at", "paid_at", "checked_out_at",
                    "hold_expires_at", "updated_at"):
            if key in d and d[key] is not None:
                d[key] = local_str(d[key])
        if "room_number" in d:
            pass
        elif row.get("room_id"):
            room = fetch_one(conn, "SELECT number FROM rooms WHERE id = %s", (row["room_id"],))
            d["room_number"] = room["number"] if room else None
        else:
            d["room_number"] = None
        info = ROOM_TYPES.get(row.get("room_type")) or {}
        d["room_label"] = info.get("label", row.get("room_type") or "")
        d["check_in_fmt"] = show_fmt(row.get("check_in"))
        d["check_out_fmt"] = show_fmt(row.get("check_out"))
        product_labels = {
            "momento": f"Momento ({row['hours']}h)" if row.get("hours") else "Momento",
            "amanecida": "Amanecida",
            "hospedaje": f"Hospedaje ({row['hours'] // 24} día{'s' if row.get('hours') and row['hours'] > 24 else ''})" if row.get("hours") else "Hospedaje",
            "reserva": "Reserva",
        }
        d["product_label"] = product_labels.get(row.get("product"), row.get("product"))
        if row.get("product") == "reserva":
            if row.get("status") == "pendiente":
                hold = row.get("hold_expires_at") or (row.get("created_at") + timedelta(minutes=HOLD_MINUTES))
                d["hold_remaining_seconds"] = max(0, int((hold - now()).total_seconds())) if hold else None
            else:
                d["hold_remaining_seconds"] = 0
        else:
            d["hold_remaining_seconds"] = None
        d["items"] = self._order_items(row)
        return d

    def _order_items(self, row):
        description = {
            "momento": f"Momento ({row['hours']}h)" if row.get("hours") else "Momento",
            "amanecida": "Amanecida",
            "hospedaje": f"Hospedaje ({row['hours'] // 24} día{'s' if row.get('hours') and row['hours'] > 24 else ''})" if row.get("hours") else "Hospedaje",
            "reserva": "Reserva",
        }.get(row.get("product"), row.get("product"))
        return [{"description": description, "amount": num(row.get("subtotal") or 0)}]

    def _order_payments(self, conn, order_id):
        rows = fetch_all(
            conn, "SELECT * FROM payments WHERE order_id = %s ORDER BY id DESC", (order_id,)
        )
        result = []
        for r in rows:
            p = dict(r)
            p["amount"] = round(int(p["amount_cents"]) / 100, 2)
            for key in ("paid_at", "created_at"):
                if p.get(key) is not None:
                    p[key] = local_str(p[key])
            result.append(p)
        return result

    def create_order(self, data):
        product = (data.get("product") or "").strip()
        if product not in ORDER_PRODUCTS:
            raise ValueError("product inválido (momento, amanecida, hospedaje, reserva)")
        guest_name = (data.get("guest_name") or "").strip()
        id_document = (data.get("id_document") or "").strip() or None
        if not guest_name:
            raise ValueError("guest_name es obligatorio")
        room_type = (data.get("room_type") or "").strip()
        if room_type not in ROOM_TYPES:
            raise ValueError("room_type inválido")
        info = ROOM_TYPES[room_type]
        client_ref = (data.get("client_ref") or "").strip() or None
        hotel_id = self.HOTEL
        conn = self._conn()
        try:
            if client_ref:
                existing = fetch_one(
                    conn, "SELECT * FROM orders WHERE client_ref = %s", (client_ref,)
                )
                if existing:
                    conn.commit()
                    self._send(200, {
                        "order": self._order_dict(conn, existing),
                        "message": "Solicitud duplicada: se devuelve la orden existente",
                    })
                    return
            if product == "reserva":
                check_in_dt = now()
                check_out_dt = check_in_dt + timedelta(hours=1)
                row = db_exec(
                    conn,
                    "INSERT INTO orders (hotel_id, guest_name, id_document, product, room_type, "
                    "check_in, check_out, subtotal, status, payment_method, client_ref) "
                    "VALUES (%s, %s, %s, 'reserva', %s, %s, %s, 0, 'por_asignar', 'pendiente', %s) "
                    "ON CONFLICT (hotel_id, client_ref) DO NOTHING RETURNING id",
                    (hotel_id, guest_name, id_document, room_type, check_in_dt, check_out_dt, client_ref),
                )
                if not row:
                    existing = fetch_one(conn, "SELECT * FROM orders WHERE client_ref = %s", (client_ref,))
                    conn.commit()
                    self._send(200, {
                        "order": self._order_dict(conn, existing),
                        "message": "Solicitud duplicada: se devuelve la orden existente",
                    })
                    return
                order_id = row[0]["id"]
                audit(conn, hotel_id, "crear_reserva", order_id, None, "kiosco",
                      f"Reserva {room_type} desde {local_str(check_in_dt)} (mín. 1 hora, esperando asignación)")
                pg_notify_change(conn, "data_changed", {"type": "reserva_creada", "order_id": order_id})
                conn.commit()
                order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
                result = self._order_dict(conn, order)
                result["message"] = "Reserva registrada"
                sse_broadcast("data_changed", {"type": "reserva_creada", "order_id": order_id})
                self._send(201, {"order": result})
                return

            try:
                overrides = self._price_overrides()
            except Exception:
                overrides = {}

            if product == "suite":
                if room_type != "suite":
                    raise ValueError("Suite solo disponible para tipo suite")
                extra = (data.get("extra") or "momento").strip() or "momento"
                if extra not in ("momento", "amanecida", "hospedaje"):
                    raise ValueError("extra inválido para suite (momento/amanecida/hospedaje)")
                base_price = info.get(extra)
                if base_price is None:
                    raise ValueError(f"Suite no ofrece '{extra}'")
                subtotal = float(base_price)
                suite_ov = overrides.get("suite")
                if isinstance(suite_ov, dict):
                    if extra in suite_ov and isinstance(suite_ov[extra], (int, float)):
                        subtotal = float(suite_ov[extra])
                    elif isinstance(suite_ov.get("extras"), dict) and extra in suite_ov["extras"]:
                        try:
                            subtotal = float(suite_ov["extras"][extra])
                        except Exception:
                            pass
                elif isinstance(suite_ov, (int, float)) and extra == "momento":
                    subtotal = float(suite_ov)
                try:
                    alt = self._apply_price_override(overrides, "suite", base_price)
                    if alt != base_price and extra == "momento":
                        subtotal = float(alt)
                except Exception:
                    pass
                if extra == "momento":
                    hours_val = 3
                    check_in_dt = now()
                    check_out_dt = check_in_dt + timedelta(hours=3)
                elif extra == "amanecida":
                    entry = info.get("amanecida_entry", AMANECIDA_ENTRY)
                    entry_dt = now().replace(hour=int(entry[:2]), minute=int(entry[3:5]), second=0, microsecond=0)
                    now_local = now()
                    check_in_dt = now_local if now_local > entry_dt else entry_dt
                    exit_dt = entry_dt + timedelta(days=1)
                    check_out_dt = exit_dt.replace(hour=int(AMANECIDA_EXIT[:2]), minute=int(AMANECIDA_EXIT[3:5]))
                    hours_val = None
                else:
                    try:
                        days = int(data.get("days", 1))
                    except Exception:
                        days = 1
                    days = max(1, min(days, 30))
                    hours_val = days * 24
                    check_in_dt = now()
                    check_out_dt = check_in_dt + timedelta(days=days)
                    if days > 1:
                        subtotal = round(subtotal * days, 2)
            elif product == "momento":
                price = info.get(product)
                if price is None:
                    raise ValueError(f"'{info['label']}' no ofrece el producto '{product}'")
                price = self._apply_price_override(overrides, room_type, price)
                if info.get("momento_solo_sin_otras"):
                    other_free = fetch_one(
                        conn,
                        "SELECT COUNT(*) AS n FROM rooms WHERE status = 'libre' AND type IN ('estandar', 'matrimonial')",
                    )["n"]
                    if int(other_free) > 0:
                        raise ValueError("Las dobles se venden de momento solo cuando no hay otras habitaciones")
                extra = (data.get("extra") or "").strip() or None
                hours = 3
                if extra == "1h":
                    if "1h" not in info.get("extras", {}):
                        raise ValueError("1 hora adicional no disponible para este tipo")
                    hours = 4
                elif extra == "6h":
                    if "6h" not in info.get("extras", {}):
                        raise ValueError("Doble tiempo no disponible para este tipo")
                    hours = 6
                elif extra:
                    raise ValueError("extra inválido")
                hours_val = hours
                check_in_dt = now()
                check_out_dt = check_in_dt + timedelta(hours=hours)
                if extra == "6h":
                    base_extra = info["extras"]["6h"]["price"]
                    subtotal = self._apply_price_override(overrides, room_type, base_extra, extra_key="6h")
                elif extra == "1h":
                    base_extra = info["extras"]["1h"]["price"]
                    subtotal = price + self._apply_price_override(overrides, room_type, base_extra, extra_key="1h")
                else:
                    subtotal = price
            elif product == "amanecida":
                price = info.get(product)
                if price is None:
                    raise ValueError(f"'{info['label']}' no ofrece el producto '{product}'")
                price = self._apply_price_override(overrides, room_type, price)
                entry = info.get("amanecida_entry", AMANECIDA_ENTRY)
                entry_dt = now().replace(hour=int(entry[:2]), minute=int(entry[3:5]), second=0, microsecond=0)
                now_local = now()
                check_in_dt = now_local if now_local > entry_dt else entry_dt
                exit_dt = entry_dt + timedelta(days=1)
                check_out_dt = exit_dt.replace(hour=int(AMANECIDA_EXIT[:2]), minute=int(AMANECIDA_EXIT[3:5]))
                hours_val = None
                subtotal = price
            elif product == "hospedaje":
                price = info.get(product)
                if price is None:
                    raise ValueError(f"'{info['label']}' no ofrece el producto '{product}'")
                price = self._apply_price_override(overrides, room_type, price)
                try:
                    days = int(data.get("days", 1))
                except (TypeError, ValueError):
                    raise ValueError("days debe ser un entero")
                if days < 1 or days > 30:
                    raise ValueError("days debe estar entre 1 y 30")
                hours_val = days * 24
                check_in_dt = now()
                check_out_dt = check_in_dt + timedelta(days=days)
                subtotal = round(price * days, 2)

            row = db_exec(
                conn,
                "INSERT INTO orders (hotel_id, guest_name, id_document, product, room_type, hours, "
                "check_in, check_out, subtotal, status, payment_method, client_ref) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'por_asignar', 'pendiente', %s) "
                "ON CONFLICT (hotel_id, client_ref) DO NOTHING RETURNING id",
                (hotel_id, guest_name, id_document, product, room_type, hours_val,
                 check_in_dt, check_out_dt, subtotal, client_ref),
            )
            if not row:
                if client_ref:
                    existing = fetch_one(conn, "SELECT * FROM orders WHERE client_ref = %s", (client_ref,))
                    conn.commit()
                    self._send(200, {
                        "order": self._order_dict(conn, existing),
                        "message": "Solicitud duplicada: se devuelve la orden existente",
                    })
                    return
                raise ValueError("Error al crear la orden")
            order_id = row[0]["id"]
            audit(conn, hotel_id, "crear_orden", order_id, None, "kiosco",
                  f"{guest_name}: {product} ${subtotal:.2f} (esperando asignación)")
            pg_notify_change(conn, "data_changed", {"type": "orden_creada", "order_id": order_id, "room_id": None})
            conn.commit()
            order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
            sse_broadcast("data_changed", {"type": "orden_creada", "order_id": order_id, "room_id": None})
            self._send(201, {"order": self._order_dict(conn, order)})
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)

    def get_orders(self):
        qs = self._qs()
        status = (qs.get("status") or [""])[0].strip()
        product = (qs.get("product") or [""])[0].strip()
        search = (qs.get("search") or [""])[0].strip()
        from_raw = (qs.get("from") or [""])[0].strip()
        to_raw = (qs.get("to") or [""])[0].strip()
        try:
            limit = int((qs.get("limit") or ["50"])[0])
            page = int((qs.get("page") or ["1"])[0])
        except ValueError:
            raise ValueError("limit y page deben ser enteros")
        limit = max(1, min(limit, 200))
        page = max(1, page)
        if status and status not in ORDER_STATUSES:
            raise ValueError("status inválido")
        if product and product not in ORDER_PRODUCTS:
            raise ValueError("product inválido")

        where, params = [], []
        if status:
            where.append("o.status = %s")
            params.append(status)
        if product:
            where.append("o.product = %s")
            params.append(product)
        if from_raw:
            from_dt = parse_date_local(from_raw, "from")
            where.append("o.created_at >= %s")
            params.append(from_dt)
        if to_raw:
            to_dt = parse_date_local(to_raw, "to") + timedelta(days=1)
            where.append("o.created_at < %s")
            params.append(to_dt)
        if search:
            where.append("(o.guest_name LIKE %s OR r.number LIKE %s OR CAST(o.id AS TEXT) LIKE %s)")
            like = f"%{search}%"
            params.extend([like, like, like])
        where_sql = ("WHERE " + " AND ".join(where)) if where else ""

        conn = self._conn()
        try:
            total = fetch_one(
                conn,
                f"SELECT COUNT(*) AS n FROM orders o LEFT JOIN rooms r ON r.id = o.room_id {where_sql}",
                params,
            )["n"]
            total = int(total)
            pages = max(1, math.ceil(total / limit)) if total else 1
            page = min(page, pages)
            offset = (page - 1) * limit
            rows = fetch_all(
                conn,
                f"""
                SELECT o.*, r.number AS room_number FROM orders o LEFT JOIN rooms r ON r.id = o.room_id
                {where_sql}
                ORDER BY o.id DESC LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            result = [self._order_dict(conn, r) for r in rows]
        finally:
            release_conn(conn)
        self._send(200, {"orders": result, "total": total, "page": page, "pages": pages})

    def get_order_detail(self, path):
        try:
            order_id = int(path[len("/api/orders/"):].rstrip("/"))
        except ValueError:
            raise ValueError("id de orden inválido")
        conn = self._conn()
        try:
            order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
            if not order:
                self._error(404, "Orden no encontrada")
                return
            detail = self._order_dict(conn, order)
            detail["payments_history"] = self._order_payments(conn, order_id)
        finally:
            release_conn(conn)
        self._send(200, {"order": detail})

    def get_reservations(self):
        qs = self._qs()
        status = (qs.get("status") or [""])[0].strip()
        if status and status not in ("pendiente", "confirmada", "vencida", "anulado"):
            raise ValueError("status inválido (pendiente, confirmada, vencida, anulado)")
        try:
            limit = int((qs.get("limit") or ["100"])[0])
        except ValueError:
            raise ValueError("limit debe ser un entero")
        limit = max(1, min(limit, 100))
        where, params = ["o.product = 'reserva'"], []
        if status:
            where.append("o.status = %s")
            params.append(status)
        conn = self._conn()
        try:
            rows = fetch_all(
                conn,
                f"SELECT o.*, r.number AS room_number FROM orders o LEFT JOIN rooms r ON r.id = o.room_id WHERE {' AND '.join(where)} ORDER BY o.id DESC LIMIT %s",
                params + [limit],
            )
            result = [self._order_dict(conn, r) for r in rows]
        finally:
            release_conn(conn)
        self._send(200, {"reservations": result})

    def _assign_room(self, conn, room_type):
        row = fetch_one(
            conn,
            """
            SELECT * FROM rooms WHERE type = %s AND status = 'libre'
            ORDER BY CASE WHEN number = 'Suite' THEN 1 ELSE 0 END,
                     CASE WHEN number ~ '^[0-9]+$' THEN number::INTEGER ELSE 0 END
            LIMIT 1 FOR UPDATE
            """,
            (room_type,),
        )
        if not row:
            raise ValueError(f"No hay habitaciones libres de tipo '{room_type}'")
        db_exec(conn, "UPDATE rooms SET status = 'ocupado' WHERE id = %s", (row["id"],))
        room_history(conn, row["id"], "ocupado")
        return row

    def assign_order(self, path, data, sess):
        order_id = int(path.split("/")[-2])
        requested_room = None
        if data is not None and data.get("room_id") is not None:
            try:
                requested_room = int(data.get("room_id"))
            except (TypeError, ValueError):
                raise ValueError("room_id debe ser un entero")
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (order_id,))
            if not order:
                self._error(404, "Orden no encontrada")
                return
            if order["status"] != "por_asignar":
                raise ValueError(f"La orden no está pendiente de asignación (estado: {order['status']})")
            if not order["room_type"]:
                raise ValueError("La orden no tiene tipo de habitación definido")
            if requested_room:
                room = fetch_one(
                    conn,
                    "SELECT * FROM rooms WHERE id = %s AND status = 'libre' FOR UPDATE",
                    (requested_room,),
                )
                if not room:
                    raise ValueError("La habitación seleccionada no está libre")
                if room["type"] != order["room_type"]:
                    raise ValueError(
                        f"La habitación {room['number']} es '{room['type']}', pero la orden requiere '{order['room_type']}'"
                    )
                db_exec(conn, "UPDATE rooms SET status = 'ocupado' WHERE id = %s", (room["id"],))
                room_history(conn, room["id"], "ocupado")
            else:
                room = self._assign_room(conn, order["room_type"])
            now_dt = now()
            if order["product"] == "reserva":
                hold_expires_at = now_dt + timedelta(minutes=HOLD_MINUTES)
                db_exec(
                    conn,
                    "UPDATE orders SET room_id = %s, status = 'pendiente', hold_expires_at = %s, updated_at = %s WHERE id = %s",
                    (room["id"], hold_expires_at, now_dt, order_id),
                )
            else:
                db_exec(
                    conn,
                    "UPDATE orders SET room_id = %s, status = 'pendiente', updated_at = %s WHERE id = %s",
                    (room["id"], now_dt, order_id),
                )
            audit(conn, hotel_id, "asignar_habitacion", order_id, room["id"], sess["username"],
                  f"Orden {order_id} -> hab. {room['number']} ({room['type']})")
            pg_notify_change(conn, "data_changed", {"type": "orden_asignada", "order_id": order_id, "room_id": room["id"]})
            conn.commit()
            fresh = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
            result = self._order_dict(conn, fresh)
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("data_changed", {"type": "orden_asignada", "order_id": order_id, "room_id": result.get("room_id")})
        self._send(200, {"order": result})

    def _hotel_config(self, conn, hotel_id):
        row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (hotel_id,))
        return dict(row["config"] or {}) if row else {}

    def pay_order(self, path, data, sess):
        order_id = int(path.split("/")[-2])
        method = (data.get("payment_method") or "").strip()
        if method not in ("efectivo", "transferencia"):
            raise ValueError("payment_method es obligatorio y debe ser: efectivo o transferencia")
        reference = (data.get("payment_reference") or "").strip() or None
        if method == "transferencia" and not reference:
            raise ValueError("payment_reference es obligatorio para transferencia")
        idempotency_key = (data.get("idempotency_key") or "").strip() or None
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (order_id,))
            if not order:
                self._error(404, "Orden no encontrada")
                return

            cfg = self._hotel_config(conn, hotel_id)
            subtotal = order["subtotal"]
            if order["product"] == "reserva" and order["subtotal"] == 0:
                amount = data.get("amount")
                if amount is None or amount == "":
                    try:
                        tarifa = float(cfg.get("reserva_tarifa") or 0)
                    except (TypeError, ValueError):
                        tarifa = 0.0
                    if tarifa <= 0:
                        raise ValueError("monto es obligatorio para reservas sin tarifa definida")
                    subtotal = round(tarifa, 2)
                else:
                    try:
                        subtotal = round(float(amount), 2)
                    except (TypeError, ValueError):
                        raise ValueError("monto debe ser un número")
                    if subtotal <= 0:
                        raise ValueError("monto debe ser mayor a 0")
            subtotal = float(subtotal)
            amount_cents = round(subtotal * 100)

            duplicate = None
            if idempotency_key:
                duplicate = fetch_one(
                    conn, "SELECT * FROM payments WHERE idempotency_key = %s", (idempotency_key,)
                )
            else:
                since = now() - timedelta(seconds=PAY_DEDUPE_SECONDS)
                duplicate = fetch_one(
                    conn,
                    "SELECT * FROM payments WHERE order_id = %s AND amount_cents = %s AND method = %s "
                    "AND paid_at >= %s ORDER BY id DESC LIMIT 1",
                    (order_id, amount_cents, method, since),
                )
            if duplicate:
                conn.commit()
                self._send(200, {
                    "order": self._order_dict(conn, order),
                    "duplicate": True,
                    "message": "Pago duplicado: se devuelve el registro existente",
                })
                return

            if order["status"] == "anulado":
                raise ValueError("No se puede pagar una orden anulada")
            if order["status"] in ("pagado", "confirmada"):
                raise ValueError("La orden ya está pagada")
            if order["status"] in ("finalizada", "vencida"):
                raise ValueError("No se puede pagar una orden finalizada o vencida")

            if order["product"] == "reserva":
                hold = order["hold_expires_at"] or (order["created_at"] + timedelta(minutes=HOLD_MINUTES))
                if hold and hold < now():
                    raise ValueError("El hold de la reserva expiró; la habitación ya no está retenida")

            paid_at = now()
            new_status = "confirmada" if order["product"] == "reserva" else "pagado"
            inserted = db_exec(
                conn,
                "INSERT INTO payments (hotel_id, order_id, amount_cents, currency, method, reference, "
                "paid_at, recorded_by, idempotency_key) "
                "VALUES (%s, %s, %s, 'USD', %s, %s, %s, %s, %s) "
                "ON CONFLICT (hotel_id, idempotency_key) DO NOTHING RETURNING id",
                (hotel_id, order_id, amount_cents, method, reference, paid_at, sess["username"], idempotency_key),
            )
            if not inserted:
                conn.commit()
                self._send(200, {
                    "order": self._order_dict(conn, order),
                    "duplicate": True,
                    "message": "Pago duplicado: se devuelve el registro existente",
                })
                return
            db_exec(
                conn,
                "UPDATE orders SET status = %s, payment_method = %s, payment_reference = %s, "
                "subtotal = %s, paid_at = %s, paid_by = %s, updated_at = %s WHERE id = %s",
                (new_status, method, reference, subtotal, paid_at, sess["username"], paid_at, order_id),
            )
            details = f"Pago {method} confirmado: ${subtotal:.2f}"
            if reference:
                details += f" (ref {reference})"
            audit(conn, hotel_id, "confirmar_pago", order_id, order["room_id"], sess["username"], details)
            pg_notify_change(conn, "data_changed", {"type": "pago_confirmado", "order_id": order_id})
            conn.commit()
            fresh = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
            result = self._order_dict(conn, fresh)
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("data_changed", {"type": "pago_confirmado", "order_id": order_id})
        self._send(200, {"order": result})

    def cancel_order(self, path, data, sess):
        order_id = int(path.split("/")[-2])
        reason = (data.get("reason") or "sin motivo").strip()
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (order_id,))
            if not order:
                self._error(404, "Orden no encontrada")
                return
            if order["status"] == "anulado":
                raise ValueError("La orden ya está anulada")
            if order["status"] in ("pagado", "confirmada"):
                raise ValueError("La orden ya está pagada; no puede anularse")
            if order["status"] in ("finalizada", "vencida"):
                raise ValueError("La orden ya está finalizada o vencida; no puede anularse")
            db_exec(conn, "UPDATE orders SET status = 'anulado', updated_at = %s WHERE id = %s", (now(), order_id))
            if order["room_id"]:
                db_exec(conn, "UPDATE rooms SET status = 'libre' WHERE id = %s AND status = 'ocupado'", (order["room_id"],))
                room_history(conn, order["room_id"], "libre")
            audit(conn, hotel_id, "anular_orden", order_id, order["room_id"], sess["username"], reason)
            pg_notify_change(conn, "data_changed", {"type": "orden_anulada", "order_id": order_id})
            conn.commit()
            fresh = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
            result = self._order_dict(conn, fresh)
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("data_changed", {"type": "orden_anulada", "order_id": order_id})
        self._send(200, {"order": result})

    def checkout_order(self, path, sess):
        order_id = int(path.split("/")[-2])
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (order_id,))
            if not order:
                self._error(404, "Orden no encontrada")
                return
            if order["status"] in ("finalizada", "vencida", "anulado"):
                raise ValueError("La orden ya está finalizada, vencida o anulada")
            if order["status"] not in ("pagado", "confirmada"):
                raise ValueError("Solo se puede hacer checkout de una orden pagada o confirmada")
            now_dt = now()
            db_exec(
                conn,
                "UPDATE orders SET status = 'finalizada', checked_out_at = %s, updated_at = %s WHERE id = %s",
                (now_dt, now_dt, order_id),
            )
            if order["room_id"]:
                db_exec(conn, "UPDATE rooms SET status = 'en_limpieza' WHERE id = %s", (order["room_id"],))
                room_history(conn, order["room_id"], "en_limpieza")
                db_exec(
                    conn,
                    "INSERT INTO cleaning_tasks (hotel_id, room_id, order_id, status, created_at) "
                    "VALUES (%s, %s, %s, 'pendiente', %s)",
                    (hotel_id, order["room_id"], order_id, now_dt),
                )
            audit(conn, hotel_id, "checkout", order_id, order["room_id"], sess["username"],
                  f"Checkout a las {local_str(now_dt)}")
            pg_notify_change(conn, "data_changed", {"type": "checkout", "order_id": order_id})
            conn.commit()
            fresh = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
            result = self._order_dict(conn, fresh)
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("data_changed", {"type": "checkout", "order_id": order_id})
        self._send(200, {"order": result})

    def extend_order(self, path, data, sess):
        order_id = int(path.split("/")[-2])
        extra = (data.get("extra") or "").strip()
        if extra not in EXTEND_OPTIONS:
            raise ValueError("extra debe ser '1h' o '6h'")
        hours, price = EXTEND_OPTIONS[extra]
        method = (data.get("payment_method") or "").strip()
        if method not in ("efectivo", "transferencia"):
            raise ValueError("payment_method es obligatorio y debe ser: efectivo o transferencia")
        reference = (data.get("payment_reference") or "").strip() or None
        if method == "transferencia" and not reference:
            raise ValueError("payment_reference es obligatorio para transferencia")
        idempotency_key = (data.get("idempotency_key") or "").strip() or None
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (order_id,))
            if not order:
                self._error(404, "Orden no encontrada")
                return
            if idempotency_key:
                dup = fetch_one(conn, "SELECT id FROM payments WHERE idempotency_key = %s", (idempotency_key,))
                if dup:
                    conn.commit()
                    self._send(200, {
                        "order": self._order_dict(conn, order),
                        "duplicate": True,
                        "message": "Extensión duplicada: se devuelve el estado existente",
                    })
                    return
            if order["status"] not in ("pagado", "confirmada"):
                raise ValueError(
                    f"Extensión solo permitida en órdenes pagadas o confirmadas (estado: {order['status']})"
                )
            info = ROOM_TYPES.get(order["room_type"]) or {}
            if extra not in info.get("extras") or {}:
                raise ValueError(
                    f"El tipo de habitación '{order['room_type']}' no ofrece extensión de {extra}"
                )
            new_check_out = order["check_out"] + timedelta(hours=hours)
            new_subtotal = float(order["subtotal"]) + price
            amount_cents = round(price * 100)
            inserted = db_exec(
                conn,
                "INSERT INTO payments (hotel_id, order_id, amount_cents, currency, method, reference, "
                "paid_at, recorded_by, idempotency_key) "
                "VALUES (%s, %s, %s, 'USD', %s, %s, %s, %s, %s) "
                "ON CONFLICT (hotel_id, idempotency_key) DO NOTHING RETURNING id",
                (hotel_id, order_id, amount_cents, method, reference, now(), sess["username"], idempotency_key),
            )
            if not inserted:
                conn.commit()
                self._send(200, {
                    "order": self._order_dict(conn, order),
                    "duplicate": True,
                    "message": "Extensión duplicada: se devuelve el estado existente",
                })
                return
            db_exec(
                conn,
                "UPDATE orders SET check_out = %s, subtotal = %s, updated_at = %s WHERE id = %s",
                (new_check_out, round(new_subtotal, 2), now(), order_id),
            )
            audit(conn, hotel_id, "extender_estadia", order_id, order["room_id"], sess["username"],
                  f"Extensión +{hours}h (${price:.2f} {method})")
            pg_notify_change(conn, "data_changed", {"type": "orden_extendida", "order_id": order_id, "hours": hours})
            conn.commit()
            fresh = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
            result = {
                "order": self._order_dict(conn, fresh),
                "extension": {
                    "hours": hours,
                    "amount": price,
                    "new_check_out_fmt": show_fmt(new_check_out),
                },
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("data_changed", {"type": "orden_extendida", "order_id": order_id, "hours": hours})
        self._send(200, result)

    def _sla_fields(self, conn, task):
        """SLA: base = started_at o created_at; vencida si base + sla_minutes < ahora (de hotels.config, default 60)."""
        status = task.get("status")
        sla = 60
        hotel_id = task.get("hotel_id")
        if hotel_id:
            row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (hotel_id,))
            if row:
                try:
                    sla = int((row.get("config") or {}).get("cleaning_sla_minutes") or 60)
                except (TypeError, ValueError):
                    sla = 60
        if status == "completada":
            return {"sla_minutes": sla, "sla_overdue": False, "sla_overdue_minutes": 0}
        base = task.get("started_at") or task.get("created_at") or task.get("task_created_at")
        if base is None:
            return {"sla_minutes": sla, "sla_overdue": False, "sla_overdue_minutes": 0}
        if base.tzinfo is None:
            base = base.replace(tzinfo=ECUADOR_TZ)
        else:
            base = base.astimezone(ECUADOR_TZ)
        overdue_minutes = int((now() - base).total_seconds() // 60) - sla
        return {
            "sla_minutes": sla,
            "sla_overdue": overdue_minutes > 0,
            "sla_overdue_minutes": max(0, overdue_minutes),
        }

    def _cleaning_dict(self, conn, row):
        d = dict(row)
        d["assigned_to"] = d.get("assigned_to")
        d.update(self._sla_fields(conn, d))
        if d.get("room_id"):
            room = fetch_one(conn, "SELECT * FROM rooms WHERE id = %s", (d["room_id"],))
            if room:
                d["room_number"] = room["number"]
                d["room_type"] = room["type"]
                d["room_label"] = ROOM_TYPES.get(room["type"], {}).get("label", room["type"])
        open_inc = None
        if d.get("id"):
            open_inc = fetch_one(
                conn,
                "SELECT id, created_at FROM incidences WHERE task_id = %s AND status = 'abierta' "
                "ORDER BY id DESC LIMIT 1",
                (d["id"],),
            )
        d["has_incidence_open"] = bool(open_inc)
        d["paused_at"] = local_str(open_inc["created_at"]) if open_inc else None
        for key in ("started_at", "completed_at", "created_at"):
            if d.get(key) is not None:
                d[key] = local_str(d[key])
        return d

    def get_housekeeping_tasks(self):
        qs = self._qs()
        status = (qs.get("status") or [""])[0].strip()
        from_raw = (qs.get("from") or [""])[0].strip()
        to_raw = (qs.get("to") or [""])[0].strip()
        if status and status not in CLEANING_STATUSES:
            raise ValueError("status inválido (pendiente, en_proceso, pausada, completada, incidencia)")
        where, params = [], []
        if status:
            where.append("ct.status = %s")
            params.append(status)
        if from_raw:
            from_dt = parse_date_local(from_raw, "from")
            where.append("ct.created_at >= %s")
            params.append(from_dt)
        if to_raw:
            to_dt = parse_date_local(to_raw, "to") + timedelta(days=1)
            where.append("ct.created_at < %s")
            params.append(to_dt)
        where_sql = ("WHERE " + " AND ".join(where)) if where else ""
        conn = self._conn()
        try:
            rows = fetch_all(
                conn,
                f"""
                SELECT ct.id, ct.hotel_id, ct.room_id, ct.order_id, ct.status, ct.started_at,
                       ct.completed_at, ct.assigned_to, ct.notes, ct.created_at,
                       r.number AS room_number, r.type AS room_type,
                       o.guest_name, o.product
                FROM cleaning_tasks ct
                JOIN rooms r ON r.id = ct.room_id
                LEFT JOIN orders o ON o.id = ct.order_id
                {where_sql}
                ORDER BY CASE ct.status WHEN 'pendiente' THEN 0 WHEN 'en_proceso' THEN 1
                         WHEN 'pausada' THEN 2 WHEN 'incidencia' THEN 3 ELSE 4 END, ct.id DESC
                """,
                params,
            )
            open_incs = {}
            ids = [r["id"] for r in rows]
            if ids:
                for inc in fetch_all(
                    conn,
                    "SELECT id, task_id, created_at FROM incidences "
                    "WHERE task_id = ANY(%s) AND status = 'abierta'",
                    (ids,),
                ):
                    open_incs.setdefault(inc["task_id"], inc)
            result = []
            for r in rows:
                d = dict(r)
                d["assigned_to"] = r["assigned_to"]
                d.update(self._sla_fields(conn, d))
                d["room_label"] = ROOM_TYPES.get(r["room_type"], {}).get("label", r["room_type"])
                inc = open_incs.get(r["id"])
                d["has_incidence_open"] = bool(inc)
                d["paused_at"] = local_str(inc["created_at"]) if inc else None
                for key in ("started_at", "completed_at", "created_at"):
                    if d.get(key) is not None:
                        d[key] = local_str(d[key])
                result.append(d)
        finally:
            release_conn(conn)
        self._send(200, {"tasks": result})

    def _staff_dict(self, row):
        d = dict(row)
        d["active"] = bool(d["active"])
        if d.get("created_at") is not None:
            d["created_at"] = local_str(d["created_at"])
        return d

    def get_housekeeping_staff(self):
        """Cargas por persona; el promedio usa el global del hotel si la persona tiene <3 tareas completadas."""
        now_dt = now()
        today_start = datetime(now_dt.year, now_dt.month, now_dt.day, tzinfo=ECUADOR_TZ)
        conn = self._conn()
        try:
            rows = fetch_all(conn, "SELECT * FROM housekeeping_staff ORDER BY id")
            names = [r["name"] for r in rows]
            loads = {}
            if names:
                for r in fetch_all(
                    conn,
                    """
                    SELECT assigned_to AS name,
                           COUNT(*) FILTER (WHERE status IN ('pendiente', 'en_proceso', 'pausada')) AS active_tasks,
                           COUNT(*) FILTER (WHERE status = 'en_proceso') AS in_progress,
                           COUNT(*) FILTER (WHERE status = 'pausada') AS paused,
                           COUNT(*) FILTER (WHERE status = 'completada') AS total_completed,
                           COUNT(*) FILTER (WHERE status = 'completada' AND completed_at >= %s) AS completed_today,
                           AVG(CASE WHEN status = 'completada' AND started_at IS NOT NULL
                                    THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60.0 END) AS avg_minutes
                    FROM cleaning_tasks
                    WHERE assigned_to = ANY(%s)
                    GROUP BY assigned_to
                    """,
                    (today_start, names),
                ):
                    loads[r["name"]] = r
            global_avg_row = fetch_one(
                conn,
                "SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60.0) AS m "
                "FROM cleaning_tasks WHERE status = 'completada' AND started_at IS NOT NULL",
            )
            global_avg = num(global_avg_row["m"]) if global_avg_row and global_avg_row["m"] is not None else None
            staff = []
            for r in rows:
                d = self._staff_dict(r)
                load = loads.get(r["name"]) or {}
                d["active_tasks"] = int(load.get("active_tasks") or 0)
                d["in_progress"] = int(load.get("in_progress") or 0)
                d["paused"] = int(load.get("paused") or 0)
                d["completed_today"] = int(load.get("completed_today") or 0)
                d["total_completed"] = int(load.get("total_completed") or 0)
                personal = load.get("avg_minutes")
                avg = num(personal) if personal is not None else None
                if avg is not None and int(load.get("total_completed") or 0) < 3:
                    avg = global_avg
                d["avg_minutes"] = round(avg, 1) if avg is not None else None
                staff.append(d)
        finally:
            release_conn(conn)
        self._send(200, {"staff": staff})

    def create_housekeeping_staff(self, data, sess):
        name = (data.get("name") or "").strip()
        if not name:
            raise ValueError("name es obligatorio")
        if len(name) > 60:
            raise ValueError("name no puede superar los 60 caracteres")
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            row = fetch_one(
                conn,
                "INSERT INTO housekeeping_staff (hotel_id, name) VALUES (%s, %s) "
                "ON CONFLICT (hotel_id, name) DO UPDATE SET active = TRUE "
                "RETURNING *",
                (hotel_id, name),
            )
            audit(conn, hotel_id, "crear_personal", None, None, sess["username"],
                  f"Personal de limpieza creado/reactivado: {name}")
            conn.commit()
            result = self._staff_dict(row)
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("data_changed", {"type": "personal_actualizado", "staff_id": result["id"]})
        self._send(200, {"staff": result})

    def deactivate_housekeeping_staff(self, path, sess):
        staff_id = int(path.split("/")[-2])
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            staff = fetch_one(conn, "SELECT * FROM housekeeping_staff WHERE id = %s", (staff_id,))
            if not staff:
                self._error(404, "Personal no encontrado")
                return
            active = fetch_one(
                conn,
                "SELECT id FROM cleaning_tasks WHERE assigned_to = %s "
                "AND status IN ('pendiente', 'en_proceso', 'pausada') ORDER BY id LIMIT 1",
                (staff["name"],),
            )
            if active:
                raise ValueError("Tiene tareas activas; termine o reasigne antes")
            db_exec(conn, "UPDATE housekeeping_staff SET active = FALSE WHERE id = %s", (staff_id,))
            audit(conn, hotel_id, "desactivar_personal", None, None, sess["username"],
                  f"Personal de limpieza desactivado: {staff['name']}")
            conn.commit()
            staff = fetch_one(conn, "SELECT * FROM housekeeping_staff WHERE id = %s", (staff_id,))
            result = self._staff_dict(staff)
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("data_changed", {"type": "personal_actualizado", "staff_id": result["id"]})
        self._send(200, {"staff": result})

    def assign_staff_to_task(self, path, data, sess):
        task_id = int(path.split("/")[-2])
        raw = data.get("staff_name")
        staff_name = raw.strip() if isinstance(raw, str) else ""
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            task = self._get_cleaning_task(conn, task_id)
            if not task:
                self._error(404, "Tarea de limpieza no encontrada")
                return
            new_name = None
            detail = "Personal desasignado"
            if staff_name and staff_name.lower() != "null":
                staff = fetch_one(
                    conn,
                    "SELECT * FROM housekeeping_staff WHERE name = %s AND active = TRUE",
                    (staff_name,),
                )
                if not staff:
                    raise ValueError(f"El personal '{staff_name}' no existe o está inactivo")
                new_name = staff["name"]
                detail = f"Personal asignado: {new_name}"
            db_exec(
                conn,
                "UPDATE cleaning_tasks SET assigned_to = %s WHERE id = %s",
                (new_name, task_id),
            )
            audit(conn, hotel_id, "asignar_personal", None, task["room_id"], sess["username"],
                  f"Tarea #{task_id}: {detail}")
            pg_notify_change(conn, "limpieza_asignada", {"task_id": task_id, "assigned_to": new_name})
            conn.commit()
            task = self._get_cleaning_task(conn, task_id)
            result = self._cleaning_dict(conn, task)
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("limpieza_asignada", {"task_id": task_id, "assigned_to": new_name})
        self._send(200, {"task": result})

    def _get_cleaning_task(self, conn, task_id):
        return fetch_one(conn, "SELECT * FROM cleaning_tasks WHERE id = %s", (task_id,))

    def housekeeping_start(self, path, sess):
        task_id = int(path.split("/")[-2])
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            task = self._get_cleaning_task(conn, task_id)
            if not task:
                self._error(404, "Tarea de limpieza no encontrada")
                return
            if task["status"] == "completada":
                raise ValueError("La tarea ya está completada")
            if task["status"] != "en_proceso":
                if task["status"] == "pendiente":
                    db_exec(
                        conn,
                        "UPDATE cleaning_tasks SET status = 'en_proceso', started_at = %s WHERE id = %s",
                        (now(), task_id),
                    )
                else:
                    db_exec(
                        conn,
                        "UPDATE cleaning_tasks SET status = 'en_proceso' WHERE id = %s",
                        (task_id,),
                    )
                audit(conn, hotel_id, "housekeeping_start", None, task["room_id"], sess["username"],
                      f"Tarea #{task_id} de limpieza iniciada")
            pg_notify_change(conn, "data_changed", {"type": "limpieza_iniciada", "task_id": task_id})
            conn.commit()
            task = self._get_cleaning_task(conn, task_id)
            result = self._cleaning_dict(conn, task)
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("data_changed", {"type": "limpieza_iniciada", "task_id": task_id})
        self._send(200, {"task": result})

    def housekeeping_complete(self, path, sess):
        task_id = int(path.split("/")[-2])
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            task = self._get_cleaning_task(conn, task_id)
            if not task:
                self._error(404, "Tarea de limpieza no encontrada")
                return
            if task["status"] == "completada":
                raise ValueError("La tarea ya está completada")
            if task["status"] == "pendiente":
                raise ValueError("La tarea debe iniciarse antes")
            db_exec(
                conn,
                "UPDATE cleaning_tasks SET status = 'completada', completed_at = %s WHERE id = %s",
                (now(), task_id),
            )
            audit(conn, hotel_id, "housekeeping_complete", None, task["room_id"], sess["username"],
                  f"Tarea #{task_id} de limpieza completada")
            open_inc = fetch_one(
                conn,
                "SELECT id FROM incidences WHERE task_id = %s AND status = 'abierta' ORDER BY id DESC LIMIT 1",
                (task_id,),
            )
            if open_inc:
                db_exec(
                    conn,
                    "UPDATE incidences SET status = 'resuelta', resolved_by = %s, resolved_at = %s WHERE id = %s",
                    (sess["username"], now(), open_inc["id"]),
                )
                audit(conn, hotel_id, "incidencia_resuelta", None, task["room_id"], sess["username"],
                      f"Incidencia #{open_inc['id']} resuelta al completar la tarea #{task_id}")
            room = fetch_one(conn, "SELECT * FROM rooms WHERE id = %s", (task["room_id"],))
            if room and room["status"] == "en_limpieza":
                db_exec(conn, "UPDATE rooms SET status = 'libre' WHERE id = %s AND status = 'en_limpieza'", (task["room_id"],))
                room_history(conn, task["room_id"], "libre")
            pg_notify_change(conn, "data_changed", {"type": "limpieza_completada", "task_id": task_id})
            conn.commit()
            task = self._get_cleaning_task(conn, task_id)
            result = self._cleaning_dict(conn, task)
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("data_changed", {"type": "limpieza_completada", "task_id": task_id})
        self._send(200, {"task": result})

    def housekeeping_incident(self, path, data, sess):
        task_id = int(path.split("/")[-2])
        notes = (data.get("notes") or "").strip()
        if not notes:
            raise ValueError("notes es obligatorio para reportar una incidencia")
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            task = self._get_cleaning_task(conn, task_id)
            if not task:
                self._error(404, "Tarea de limpieza no encontrada")
                return
            if task["status"] == "completada":
                raise ValueError("La tarea ya está completada")
            open_inc = fetch_one(
                conn,
                "SELECT id FROM incidences WHERE task_id = %s AND status = 'abierta' ORDER BY id DESC LIMIT 1",
                (task_id,),
            )
            if open_inc:
                raise ValueError("Ya existe una incidencia abierta para esta tarea")
            inc_row = fetch_one(
                conn,
                "INSERT INTO incidences (hotel_id, task_id, room_id, notes, status, created_by) "
                "VALUES (%s, %s, %s, %s, 'abierta', %s) RETURNING *",
                (hotel_id, task_id, task["room_id"], notes, sess["username"]),
            )
            db_exec(
                conn,
                "UPDATE cleaning_tasks SET status = 'pausada', notes = %s WHERE id = %s",
                (notes, task_id),
            )
            audit(conn, hotel_id, "housekeeping_incident", None, task["room_id"], sess["username"],
                  f"Tarea #{task_id}: {notes}")
            pg_notify_change(conn, "data_changed", {"type": "limpieza_incidencia", "task_id": task_id})
            conn.commit()
            task = self._get_cleaning_task(conn, task_id)
            task_dict = self._cleaning_dict(conn, task)
            inc_dict = self._incidence_dict(inc_row)
            guest = fetch_one(
                conn,
                "SELECT o.guest_name FROM orders o JOIN cleaning_tasks ct ON ct.order_id = o.id "
                "WHERE ct.id = %s",
                (task_id,),
            )
            inc_dict["room_number"] = task_dict.get("room_number")
            inc_dict["room_type"] = task_dict.get("room_type")
            inc_dict["room_label"] = task_dict.get("room_label")
            inc_dict["guest_name"] = guest["guest_name"] if guest else None
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("data_changed", {"type": "limpieza_incidencia", "task_id": task_id})
        self._send(200, {"task": task_dict, "incidence": inc_dict})

    def _incidence_dict(self, row):
        d = dict(row)
        d["room_label"] = ROOM_TYPES.get(d.get("room_type") or "", {}).get("label", d.get("room_type"))
        d["created_at_fmt"] = show_fmt(d.get("created_at"))
        d["resolved_at_fmt"] = show_fmt(d.get("resolved_at"))
        return d

    def get_incidences(self):
        qs = self._qs()
        status = (qs.get("status") or [""])[0].strip()
        if status and status not in INCIDENCE_STATUSES:
            raise ValueError("status inválido (abierta, resuelta)")
        where, params = [], []
        if status:
            where.append("i.status = %s")
            params.append(status)
        where_sql = ("WHERE " + " AND ".join(where)) if where else ""
        conn = self._conn()
        try:
            rows = fetch_all(
                conn,
                f"""
                SELECT i.id, i.task_id, i.room_id, i.notes, i.status, i.created_by, i.created_at,
                       i.resolved_by, i.resolved_at, r.number AS room_number, r.type AS room_type,
                       o.guest_name
                FROM incidences i
                JOIN cleaning_tasks ct ON ct.id = i.task_id
                JOIN rooms r ON r.id = ct.room_id
                LEFT JOIN orders o ON o.id = ct.order_id
                {where_sql}
                ORDER BY i.id DESC
                """,
                params,
            )
            result = [self._incidence_dict(r) for r in rows]
        finally:
            release_conn(conn)
        self._send(200, {"incidences": result})

    def resolve_incidence(self, path, sess):
        inc_id = int(path.split("/")[-2])
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            inc = fetch_one(conn, "SELECT * FROM incidences WHERE id = %s", (inc_id,))
            if not inc:
                self._error(404, "Incidencia no encontrada")
                return
            if inc["status"] == "resuelta":
                raise ValueError("La incidencia ya está resuelta")
            task_id = inc["task_id"]
            task = self._get_cleaning_task(conn, task_id)
            db_exec(
                conn,
                "UPDATE incidences SET status = 'resuelta', resolved_by = %s, resolved_at = %s "
                "WHERE id = %s",
                (sess["username"], now(), inc_id),
            )
            if task and task["status"] == "pausada":
                db_exec(
                    conn,
                    "UPDATE cleaning_tasks SET status = 'en_proceso' WHERE id = %s",
                    (task_id,),
                )
            audit(conn, hotel_id, "incidencia_resuelta", None, inc["room_id"], sess["username"],
                  f"Incidencia #{inc_id} resuelta (tarea #{task_id})")
            pg_notify_change(conn, "data_changed", {"type": "limpieza_reanudada", "task_id": task_id})
            conn.commit()
            inc = fetch_one(conn, "SELECT * FROM incidences WHERE id = %s", (inc_id,))
            result = {"incidence": self._incidence_dict(inc)}
            task = self._get_cleaning_task(conn, task_id)
            if task:
                result["task"] = self._cleaning_dict(conn, task)
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        sse_broadcast("data_changed", {"type": "limpieza_reanudada", "task_id": task_id})
        self._send(200, result)

    def dashboard_overview(self):
        conn = self._conn()
        try:
            now_dt = now()
            date = now_dt.strftime("%Y-%m-%d")
            today_start = datetime(now_dt.year, now_dt.month, now_dt.day, tzinfo=ECUADOR_TZ)

            total_rooms = int(fetch_one(conn, "SELECT COUNT(*) AS n FROM rooms")["n"])
            free = int(fetch_one(conn, "SELECT COUNT(*) AS n FROM rooms WHERE status = 'libre'")["n"])
            occupied = int(fetch_one(conn, "SELECT COUNT(*) AS n FROM rooms WHERE status = 'ocupado'")["n"])
            cleaning = int(fetch_one(conn, "SELECT COUNT(*) AS n FROM rooms WHERE status = 'en_limpieza'")["n"])
            blocked = int(fetch_one(conn, "SELECT COUNT(*) AS n FROM rooms WHERE status = 'bloqueado'")["n"])
            occupancy_pct = round(occupied / total_rooms * 100, 1) if total_rooms else 0

            pending_payments = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM orders WHERE status = 'pendiente' AND product != 'reserva'"
            )["n"])
            to_assign = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM orders WHERE status = 'por_asignar'"
            )["n"])
            holds_active = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM orders WHERE product = 'reserva' AND status = 'pendiente'"
            )["n"])
            departures_overdue = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM orders WHERE status IN ('pagado', 'confirmada') AND check_out < %s",
                (now_dt,),
            )["n"])
            next_limit = now_dt + timedelta(hours=2)
            departures_next = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM orders WHERE status IN ('pagado', 'confirmada') "
                      "AND check_out >= %s AND check_out < %s",
                (now_dt, next_limit),
            )["n"])
            cleaning_pending = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM cleaning_tasks WHERE status IN ('pendiente', 'en_proceso', 'pausada')"
            )["n"])
            sla_row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (self.HOTEL,))
            try:
                sla_minutes = int((sla_row.get("config") or {}).get("cleaning_sla_minutes") or 60) if sla_row else 60
            except (TypeError, ValueError):
                sla_minutes = 60
            cleaning_overdue = int(fetch_one(
                conn,
                "SELECT COUNT(*) AS n FROM cleaning_tasks "
                "WHERE status IN ('pendiente', 'en_proceso', 'pausada') "
                "AND COALESCE(started_at, created_at) + make_interval(mins => %s) < %s",
                (sla_minutes, now_dt),
            )["n"])
            orders_today = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM orders WHERE created_at >= %s", (today_start,)
            )["n"])
            checkouts_today = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM orders WHERE checked_out_at >= %s", (today_start,)
            )["n"])
            reservations_pending = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM orders WHERE product = 'reserva' AND status = 'pendiente'"
            )["n"])

            occupancy_by_type = []
            for key, info in ROOM_TYPES.items():
                t = int(fetch_one(conn, "SELECT COUNT(*) AS n FROM rooms WHERE type = %s", (key,))["n"])
                f = int(fetch_one(conn, "SELECT COUNT(*) AS n FROM rooms WHERE type = %s AND status = 'libre'", (key,))["n"])
                o = int(fetch_one(conn, "SELECT COUNT(*) AS n FROM rooms WHERE type = %s AND status = 'ocupado'", (key,))["n"])
                occupancy_by_type.append({
                    "type": key,
                    "label": info.get("label", key),
                    "total": t,
                    "free": f,
                    "occupied": o,
                })

            def _attention_order(row):
                d = self._order_dict(conn, row)
                return {
                    "id": d["id"],
                    "room_number": d["room_number"],
                    "guest_name": d["guest_name"],
                    "product": d["product"],
                    "product_label": d["product_label"],
                    "check_out": d["check_out"],
                    "check_out_fmt": d["check_out_fmt"],
                    "remaining_seconds": d["remaining_seconds"],
                    "subtotal": d["subtotal"],
                }

            pp_rows = fetch_all(
                conn, "SELECT o.*, r.number AS room_number FROM orders o LEFT JOIN rooms r ON r.id = o.room_id WHERE o.status = 'pendiente' AND o.product != 'reserva' ORDER BY o.check_out ASC LIMIT 8"
            )
            attention_pending = [_attention_order(r) for r in pp_rows]

            assign_rows = fetch_all(
                conn, "SELECT o.*, r.number AS room_number FROM orders o LEFT JOIN rooms r ON r.id = o.room_id WHERE o.status = 'por_asignar' ORDER BY o.id ASC LIMIT 12"
            )
            attention_to_assign = []
            for r in assign_rows:
                d = self._order_dict(conn, r)
                waiting = max(0, int((now_dt - r["created_at"]).total_seconds()))
                attention_to_assign.append({
                    "id": d["id"],
                    "room_number": d["room_number"],
                    "guest_name": d["guest_name"],
                    "product": d["product"],
                    "product_label": d["product_label"],
                    "room_type": d["room_type"],
                    "room_label": d["room_label"],
                    "check_out_fmt": d["check_out_fmt"],
                    "remaining_seconds": d["remaining_seconds"],
                    "subtotal": d["subtotal"],
                    "created_at_fmt": show_fmt(r["created_at"]),
                    "waiting_seconds": waiting,
                })
            assign_critical = [i for i in attention_to_assign if i["waiting_seconds"] > 600]

            hold_rows = fetch_all(
                conn, "SELECT o.*, r.number AS room_number FROM orders o LEFT JOIN rooms r ON r.id = o.room_id WHERE o.product = 'reserva' AND o.status = 'pendiente' ORDER BY o.created_at ASC"
            )
            attention_holds = []
            for r in hold_rows:
                d = self._order_dict(conn, r)
                attention_holds.append({
                    "id": d["id"],
                    "room_number": d["room_number"],
                    "guest_name": d["guest_name"],
                    "room_type": d["room_type"],
                    "hold_expires_at": d["hold_expires_at"],
                    "hold_remaining_seconds": d["hold_remaining_seconds"],
                    "check_out": d["check_out"],
                    "check_out_fmt": d["check_out_fmt"],
                    "subtotal": d["subtotal"],
                })

            dep_rows = fetch_all(
                conn, "SELECT o.*, r.number AS room_number FROM orders o LEFT JOIN rooms r ON r.id = o.room_id WHERE o.status IN ('pagado', 'confirmada') ORDER BY o.check_out ASC LIMIT 8"
            )
            attention_departures = [_attention_order(r) for r in dep_rows]

            clean_rows = fetch_all(
                conn,
                """
                SELECT ct.id AS task_id, ct.status AS status, ct.started_at,
                       ct.created_at AS task_created_at, ct.order_id, ct.hotel_id, ct.assigned_to,
                       r.id AS room_id, r.number AS room_number, r.type AS room_type,
                       EXISTS (SELECT 1 FROM incidences i2
                               WHERE i2.task_id = ct.id AND i2.status = 'abierta') AS has_incidence_open
                FROM rooms r
                JOIN cleaning_tasks ct ON ct.room_id = r.id AND ct.status IN ('pendiente', 'en_proceso', 'pausada')
                WHERE r.status = 'en_limpieza'
                ORDER BY CASE ct.status WHEN 'pausada' THEN 0 WHEN 'pendiente' THEN 1
                         ELSE 2 END, ct.id DESC
                """
            )
            attention_cleaning = []
            for r in clean_rows:
                d = dict(r)
                d["task_status"] = d["status"]
                d["assigned_to"] = r["assigned_to"]
                d["has_incidence_open"] = bool(d["has_incidence_open"])
                d["room_label"] = ROOM_TYPES.get(d["room_type"], {}).get("label", d["room_type"])
                d.update(self._sla_fields(conn, d))
                d["paused_at"] = None
                if d.get("has_incidence_open"):
                    inc_row = fetch_one(
                        conn,
                        "SELECT created_at FROM incidences WHERE task_id = %s AND status = 'abierta' ORDER BY id DESC LIMIT 1",
                        (d.get("task_id"),),
                    )
                    if inc_row and inc_row["created_at"] is not None:
                        d["paused_at"] = local_str(inc_row["created_at"])
                for key in ("started_at", "task_created_at"):
                    if d.get(key) is not None:
                        d[key] = local_str(d[key])
                attention_cleaning.append(d)

            blocked_rows = fetch_all(conn, "SELECT * FROM rooms WHERE status = 'bloqueado' ORDER BY id")
            attention_blocked = [self._room_dict(r, self.HOTEL) for r in blocked_rows]

            activity_rows = fetch_all(
                conn, "SELECT action, staff_user, details, created_at FROM audit_log ORDER BY id DESC LIMIT 8"
            )
            activity = [{
                "action": r["action"],
                "label": ACTIVITY_LABELS.get(r["action"], r["action"]),
                "staff_user": r["staff_user"],
                "details": r["details"],
                "created_at": local_str(r["created_at"]),
            } for r in activity_rows]
        finally:
            release_conn(conn)

        self._send(200, {
            "as_of": now_dt.isoformat(),
            "date": date,
            "summary": {
                "total_rooms": total_rooms,
                "free": free,
                "occupied": occupied,
                "cleaning": cleaning,
                "blocked": blocked,
                "occupancy_pct": occupancy_pct,
                "pending_payments": pending_payments,
                "to_assign": to_assign,
                "holds_active": holds_active,
                "departures_overdue": departures_overdue,
                "departures_next": departures_next,
                "cleaning_pending": cleaning_pending,
                "cleaning_overdue": cleaning_overdue,
                "orders_today": orders_today,
                "checkouts_today": checkouts_today,
                "reservations_pending": reservations_pending,
            },
            "occupancy_by_type": occupancy_by_type,
            "attention": {
                "to_assign": attention_to_assign,
                "assign_critical": assign_critical,
                "pending_payments": attention_pending,
                "holds": attention_holds,
                "departures": attention_departures,
                "cleaning": attention_cleaning,
                "blocked": attention_blocked,
            },
            "activity": activity,
        })

    def dashboard_occupancy(self):
        conn = self._conn()
        try:
            result = []
            for key, info in ROOM_TYPES.items():
                rows = fetch_all(conn, "SELECT * FROM rooms WHERE type = %s ORDER BY id", (key,))
                rooms = [self._room_dict(r, self.HOTEL) for r in rows]
                counts = {"libre": 0, "ocupado": 0, "en_limpieza": 0, "bloqueado": 0}
                for r in rooms:
                    counts[r["status"]] = counts.get(r["status"], 0) + 1
                result.append({
                    "type": key,
                    "label": info.get("label", key),
                    "total": len(rooms),
                    "counts": counts,
                    "rooms": rooms,
                })
            totals = {"libre": 0, "ocupado": 0, "en_limpieza": 0, "bloqueado": 0, "total": 0}
            for group in result:
                for k in ("libre", "ocupado", "en_limpieza", "bloqueado"):
                    totals[k] += group["counts"].get(k, 0)
                totals["total"] += group["total"]
        finally:
            release_conn(conn)
        self._send(200, {"as_of": now().isoformat(), "types": result, "totals": totals})

    def dashboard_alerts(self):
        conn = self._conn()
        try:
            to_assign = int(fetch_one(conn, "SELECT COUNT(*) AS n FROM orders WHERE status = 'por_asignar'")["n"])
            pending_payments = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM orders WHERE status = 'pendiente' AND product != 'reserva'"
            )["n"])
            departures_overdue = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM orders WHERE status IN ('pagado', 'confirmada') AND check_out < %s",
                (now(),),
            )["n"])
            cleaning = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM cleaning_tasks WHERE status IN ('pendiente', 'en_proceso', 'pausada')"
            )["n"])
            sla_row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (self.HOTEL,))
            try:
                sla_minutes = int((sla_row.get("config") or {}).get("cleaning_sla_minutes") or 60) if sla_row else 60
            except (TypeError, ValueError):
                sla_minutes = 60
            cleaning_overdue = int(fetch_one(
                conn,
                "SELECT COUNT(*) AS n FROM cleaning_tasks "
                "WHERE status IN ('pendiente', 'en_proceso', 'pausada') "
                "AND COALESCE(started_at, created_at) + make_interval(mins => %s) < %s",
                (sla_minutes, now()),
            )["n"])
        finally:
            release_conn(conn)
        self._send(200, {
            "to_assign": to_assign,
            "pending_payments": pending_payments,
            "departures_overdue": departures_overdue,
            "cleaning": cleaning,
            "cleaning_overdue": cleaning_overdue,
        })

    def close_report(self):
        qs = self._qs()
        date_raw = (qs.get("date") or [""])[0].strip()
        if date_raw:
            day_start = parse_date_local(date_raw, "date")
        else:
            now_dt = now()
            day_start = datetime(now_dt.year, now_dt.month, now_dt.day, tzinfo=ECUADOR_TZ)
        day_end = day_start + timedelta(days=1)
        date_str = day_start.strftime("%Y-%m-%d")
        conn = self._conn()
        try:
            payment_rows = fetch_all(
                conn,
                """
                SELECT p.id AS payment_id, p.order_id, p.amount_cents, p.method, p.reference,
                       p.paid_at, p.recorded_by, o.guest_name, o.product, r.number AS room_number
                FROM payments p
                JOIN orders o ON o.id = p.order_id
                LEFT JOIN rooms r ON r.id = o.room_id
                WHERE p.paid_at >= %s AND p.paid_at < %s
                ORDER BY p.id ASC
                """,
                (day_start, day_end),
            )
            ordenes_creadas = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM orders WHERE created_at >= %s AND created_at < %s",
                (day_start, day_end),
            )["n"])
            pagadas = int(fetch_one(
                conn,
                "SELECT COUNT(DISTINCT order_id) AS n FROM payments WHERE paid_at >= %s AND paid_at < %s",
                (day_start, day_end),
            )["n"])
            anuladas = int(fetch_one(
                conn,
                "SELECT COUNT(*) AS n FROM orders WHERE status = 'anulado' AND created_at >= %s AND created_at < %s",
                (day_start, day_end),
            )["n"])
            vencidas = int(fetch_one(
                conn,
                "SELECT COUNT(*) AS n FROM orders WHERE status = 'vencida' AND created_at >= %s AND created_at < %s",
                (day_start, day_end),
            )["n"])
            sin_cobrar_row = fetch_one(
                conn,
                "SELECT COUNT(*) AS n, COALESCE(SUM(subtotal), 0) AS m FROM orders "
                "WHERE status = 'pendiente' AND product != 'reserva'",
            )
            sin_cobrar = int(sin_cobrar_row["n"])
            monto_sin_cobrar = num(sin_cobrar_row["m"])

            total_cobrado = 0.0
            efectivo = {"count": 0, "total": 0.0}
            transferencia = {"count": 0, "total": 0.0}
            por_producto = {}
            detalle_pagos = []
            for p in payment_rows:
                amount = round(int(p["amount_cents"]) / 100, 2)
                total_cobrado += amount
                bucket = efectivo if p["method"] == "efectivo" else transferencia
                bucket["count"] += 1
                bucket["total"] = round(bucket["total"] + amount, 2)
                prod = p["product"] or "otro"
                entry = por_producto.setdefault(prod, {"product": prod, "label": PRODUCT_LABELS.get(prod, prod), "count": 0, "total": 0.0})
                entry["count"] += 1
                entry["total"] = round(entry["total"] + amount, 2)
                detalle_pagos.append({
                    "payment_id": p["payment_id"],
                    "order_id": p["order_id"],
                    "room_number": p["room_number"],
                    "guest_name": p["guest_name"],
                    "method": p["method"],
                    "amount": amount,
                    "reference": p["reference"],
                    "paid_at": show_fmt(p["paid_at"]),
                    "recorded_by": p["recorded_by"],
                })
        finally:
            release_conn(conn)
        self._send(200, {
            "date": date_str,
            "as_of": now().isoformat(),
            "summary": {
                "ordenes_creadas": ordenes_creadas,
                "pagadas": pagadas,
                "anuladas": anuladas,
                "vencidas": vencidas,
                "sin_cobrar": sin_cobrar,
                "monto_sin_cobrar": round(monto_sin_cobrar, 2),
                "total_cobrado": round(total_cobrado, 2),
                "efectivo": efectivo,
                "transferencia": transferencia,
                "por_producto": list(por_producto.values()),
            },
            "detalle_pagos": detalle_pagos,
            "pagos": {"count": len(payment_rows), "total": round(total_cobrado, 2)},
        })

    def daily_report(self):
        qs = self._qs()
        date_raw = (qs.get("date") or [""])[0].strip()
        if date_raw:
            day_start = parse_date_local(date_raw, "date")
        else:
            now_dt = now()
            day_start = datetime(now_dt.year, now_dt.month, now_dt.day, tzinfo=ECUADOR_TZ)
        day_end = day_start + timedelta(days=1)
        date_str = day_start.strftime("%Y-%m-%d")
        conn = self._conn()
        try:
            por_producto = {}
            for r in fetch_all(
                conn,
                "SELECT product, COUNT(*) AS n FROM orders "
                "WHERE created_at >= %s AND created_at < %s GROUP BY product",
                (day_start, day_end),
            ):
                p = r["product"]
                por_producto.setdefault(p, {"product": p, "label": PRODUCT_LABELS.get(p, p), "creadas": 0, "pagadas": 0, "anuladas": 0, "total_cobrado": 0.0})["creadas"] = int(r["n"])
            for r in fetch_all(
                conn,
                "SELECT o.product, COUNT(DISTINCT p.order_id) AS n FROM payments p "
                "JOIN orders o ON o.id = p.order_id "
                "WHERE p.paid_at >= %s AND p.paid_at < %s GROUP BY o.product",
                (day_start, day_end),
            ):
                p = r["product"]
                por_producto.setdefault(p, {"product": p, "label": PRODUCT_LABELS.get(p, p), "creadas": 0, "pagadas": 0, "anuladas": 0, "total_cobrado": 0.0})["pagadas"] = int(r["n"])
            for r in fetch_all(
                conn,
                "SELECT product, COUNT(*) AS n FROM orders "
                "WHERE status = 'anulado' AND created_at >= %s AND created_at < %s GROUP BY product",
                (day_start, day_end),
            ):
                p = r["product"]
                por_producto.setdefault(p, {"product": p, "label": PRODUCT_LABELS.get(p, p), "creadas": 0, "pagadas": 0, "anuladas": 0, "total_cobrado": 0.0})["anuladas"] = int(r["n"])
            for r in fetch_all(
                conn,
                "SELECT o.product, SUM(p.amount_cents) AS m FROM payments p "
                "JOIN orders o ON o.id = p.order_id "
                "WHERE p.paid_at >= %s AND p.paid_at < %s GROUP BY o.product",
                (day_start, day_end),
            ):
                p = r["product"]
                por_producto.setdefault(p, {"product": p, "label": PRODUCT_LABELS.get(p, p), "creadas": 0, "pagadas": 0, "anuladas": 0, "total_cobrado": 0.0})["total_cobrado"] = round(num(r["m"]) / 100, 2)

            por_metodo = {}
            for r in fetch_all(
                conn,
                "SELECT method, COUNT(*) AS n, SUM(amount_cents) AS m FROM payments "
                "WHERE paid_at >= %s AND paid_at < %s GROUP BY method",
                (day_start, day_end),
            ):
                por_metodo[r["method"]] = {
                    "method": r["method"],
                    "label": "Efectivo" if r["method"] == "efectivo" else "Transferencia",
                    "count": int(r["n"]),
                    "total": round(num(r["m"]) / 100, 2),
                }

            por_tipo_habitacion = []
            for r in fetch_all(
                conn,
                "SELECT room_type, COUNT(*) AS n FROM orders "
                "WHERE created_at >= %s AND created_at < %s AND room_type IS NOT NULL GROUP BY room_type",
                (day_start, day_end),
            ):
                info = ROOM_TYPES.get(r["room_type"]) or {}
                por_tipo_habitacion.append({
                    "type": r["room_type"],
                    "label": info.get("label", r["room_type"]),
                    "ordenes": int(r["n"]),
                })

            # Ocupación pico: máximo de habitaciones ocupadas a la vez por hora.
            total_rooms = int(fetch_one(conn, "SELECT COUNT(*) AS n FROM rooms")["n"])
            active = fetch_all(
                conn,
                "SELECT room_id, check_in, check_out FROM orders "
                "WHERE room_id IS NOT NULL AND status IN ('pendiente', 'pagado', 'confirmada') "
                "AND check_in < %s AND check_out > %s",
                (day_end, day_start),
            )
            ocupacion_pico = None
            for h in range(24):
                hour_start = day_start + timedelta(hours=h)
                hour_end = hour_start + timedelta(hours=1)
                ocupadas = len({r["room_id"] for r in active
                                if r["check_in"] < hour_end and r["check_out"] > hour_start})
                pct = round(ocupadas / total_rooms * 100, 1) if total_rooms else 0
                if ocupacion_pico is None or ocupadas > ocupacion_pico["ocupadas"]:
                    ocupacion_pico = {
                        "hora": f"{h:02d}:00",
                        "ocupadas": ocupadas,
                        "total": total_rooms,
                        "pct": pct,
                    }

            anuladas = []
            for r in fetch_all(
                conn,
                "SELECT id, guest_name, created_at FROM orders "
                "WHERE status = 'anulado' AND created_at >= %s AND created_at < %s ORDER BY id",
                (day_start, day_end),
            ):
                reason_row = fetch_one(
                    conn,
                    "SELECT details FROM audit_log WHERE action = 'anular_orden' AND order_id = %s ORDER BY id DESC LIMIT 1",
                    (r["id"],),
                )
                anuladas.append({
                    "id": r["id"],
                    "guest_name": r["guest_name"],
                    "reason": reason_row["details"] if reason_row else "sin motivo",
                    "created_at_fmt": show_fmt(r["created_at"]),
                })

            limpieza_row = fetch_one(
                conn,
                "SELECT COUNT(*) AS completadas, "
                "COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60.0), 0) AS promedio "
                "FROM cleaning_tasks WHERE completed_at >= %s AND completed_at < %s",
                (day_start, day_end),
            )
            limpieza_pend = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM cleaning_tasks WHERE status IN ('pendiente', 'en_proceso', 'pausada')"
            )["n"])
            incidencias_abiertas = int(fetch_one(
                conn,
                "SELECT COUNT(*) AS n FROM incidences WHERE status = 'abierta' "
                "AND created_at >= %s AND created_at < %s",
                (day_start, day_end),
            )["n"])
            sla_row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (self.HOTEL,))
            try:
                sla_minutes = int((sla_row.get("config") or {}).get("cleaning_sla_minutes") or 60) if sla_row else 60
            except (TypeError, ValueError):
                sla_minutes = 60
            por_personal = []
            for r in fetch_all(
                conn,
                """
                SELECT s.name,
                       COUNT(ct.id) FILTER (WHERE ct.status = 'completada'
                                            AND ct.completed_at >= %s AND ct.completed_at < %s) AS completadas,
                       AVG(CASE WHEN ct.status = 'completada'
                                     AND ct.completed_at >= %s AND ct.completed_at < %s
                                     AND ct.started_at IS NOT NULL
                                THEN EXTRACT(EPOCH FROM (ct.completed_at - ct.started_at)) / 60.0 END) AS promedio_min
                FROM housekeeping_staff s
                LEFT JOIN cleaning_tasks ct ON ct.assigned_to = s.name
                    AND ((ct.completed_at >= %s AND ct.completed_at < %s)
                         OR (ct.created_at >= %s AND ct.created_at < %s))
                GROUP BY s.name
                HAVING COUNT(ct.id) > 0
                ORDER BY s.name
                """,
                (day_start, day_end, day_start, day_end, day_start, day_end, day_start, day_end),
            ):
                avg = num(r["promedio_min"]) if r["promedio_min"] is not None else None
                por_personal.append({
                    "name": r["name"],
                    "completadas": int(r["completadas"]),
                    "promedio_min": round(avg, 1) if avg is not None else None,
                })
            limpieza = {
                "completadas": int(limpieza_row["completadas"]),
                "pendientes": limpieza_pend,
                "promedio_minutos": round(num(limpieza_row["promedio"])),
                "incidencias_abiertas": incidencias_abiertas,
                "sla_minutes": sla_minutes,
                "por_personal": por_personal,
            }
        finally:
            release_conn(conn)
        self._send(200, {
            "date": date_str,
            "por_producto": list(por_producto.values()),
            "por_metodo": list(por_metodo.values()),
            "por_tipo_habitacion": por_tipo_habitacion,
            "ocupacion_pico": ocupacion_pico,
            "anuladas": anuladas,
            "limpieza": limpieza,
        })

    def get_settings(self):
        conn = self._conn()
        try:
            row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (self.HOTEL,))
            cfg = dict(row["config"] or {}) if row else {}
        finally:
            release_conn(conn)
        cfg.setdefault("reserva_tarifa", 0)
        cfg.setdefault("assign_ttl_minutes", 30)
        cfg.setdefault("cleaning_sla_minutes", 60)
        self._send(200, {"config": cfg})

    def kiosco_config(self):
        """Configuración del kiosco (usable en MODE kiosco y admin).

        Lee hotels.config; los valores pueden estar en un sub-objeto "kiosco"
        o como claves de primer nivel. Si falta una clave se usa el default,
        nunca se responde 500 por datos incompletos.
        """
        defaults = {
            "max_days": 7,
            "max_days_full": 15,
            "qr_url": "",
            "idle_timeout_seconds": 60,
            "promos": [{"title": "Amanecida 18:00-09:00", "subtitle": "Desde $20"}],
            "price_overrides": {},
            "branding": {"hotel": "Hotel Del Valle", "tagline": "Tu descanso, tu espacio"},
            "suite_durations": {"momento": 20, "amanecida": 35, "hospedaje": 50},
        }
        try:
            conn = self._conn()
            try:
                cfg = self._hotel_config(conn, self.HOTEL)
            finally:
                release_conn(conn)
        except Exception:
            cfg = {}
        kiosco = cfg.get("kiosco")
        kiosco = kiosco if isinstance(kiosco, dict) else {}

        def pick(key):
            # Prioridad: sub-objeto "kiosco" -> clave de primer nivel -> default.
            if key in kiosco and kiosco[key] is not None:
                return kiosco[key]
            if key in cfg and cfg[key] is not None:
                return cfg[key]
            return defaults[key]

        config = {}
        for key, default in defaults.items():
            value = pick(key)
            if key in ("price_overrides", "branding", "suite_durations", "promos"):
                if not isinstance(value, dict if key != "promos" else list):
                    value = default
            config[key] = value
        # 'promos' acepta dict o list; si llega dict lo dejamos de todos modos
        # (pick ya devolvió default si no era list). Se normaliza a list si dict.
        if isinstance(config["promos"], dict):
            config["promos"] = defaults["promos"]
        self._send(200, {"config": config})

    def serve_openapi(self):
        """Sirve el documento OpenAPI (openapi.yaml) en cualquier MODE."""
        try:
            p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "openapi.yaml")
            with open(p, "r", encoding="utf-8") as f:
                body = f.read().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/yaml; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception:
            self._error(500, "No se pudo leer openapi.yaml")

    def kiosco_version(self):
        """Versión actual del APK del kiosco, para el auto-update de la app."""
        try:
            p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "kiosco-version.json")
            if os.path.exists(p):
                with open(p, "r") as f:
                    payload = json.load(f)
            else:
                payload = {"version": None, "apk": "/kiosco.apk"}
            payload.setdefault("apk", "/kiosco.apk")
            self._send(200, payload)
        except Exception:
            self._error(500, "No se pudo leer la versión")

    def kiosco_update(self):
        """Endpoint de actualización local: devuelve versión + URL de descarga del servidor."""
        try:
            p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "kiosco-version.json")
            if os.path.exists(p):
                with open(p, "r") as f:
                    data = json.load(f)
            else:
                data = {"version": None}
            version = data.get("version")
            # Construir URL de descarga apuntando al servidor local
            host = self.headers.get("Host", "localhost")
            download_url = f"http://{host}/kiosco.apk"
            self._send(200, {
                "version": version,
                "download_url": download_url,
                "apk": "/kiosco.apk",
            })
        except Exception:
            self._error(500, "No se pudo verificar actualización")

    def api_health(self):
        """Endpoint ligero para healthchecks (Docker, uptime, watchdog del quiosco)."""
        db_ok = False
        try:
            conn = db()
            try:
                cur = conn.cursor()
                cur.execute("SELECT 1")
                cur.fetchone()
                db_ok = True
            finally:
                release_conn(conn)
        except Exception:
            db_ok = False
        status = "ok" if db_ok else "degraded"
        code = 200 if db_ok else 503
        self._send(code, {
            "status": status,
            "db": "ok" if db_ok else "down",
            "mode": self.MODE,
            "ts": int(time.time()),
        })

    def kiosco_crash(self, data):
        """Registra crashes de la app Android para diagnóstico remoto."""
        import datetime as _dt
        try:
            with open("/tmp/kiosco-crash.log", "a") as f:
                f.write(f"\n=== {_dt.datetime.now().isoformat()} ===\n")
                f.write(json.dumps(data, ensure_ascii=False, indent=2)[:4000] + "\n")
            self._send(200, {"ok": True})
        except Exception:
            self._error(500, "No se pudo registrar crash")

    def post_settings(self, data, sess):
        body_cfg = data.get("config")
        if not isinstance(body_cfg, dict):
            raise ValueError("config debe ser un objeto")
        cfg = dict(body_cfg)
        # Validación de config (Fase 1: evita JSONB con basura que rompe GET /types)
        if "price_overrides" in cfg and not isinstance(cfg["price_overrides"], dict):
            raise ValueError("price_overrides debe ser un objeto")
        if "branding" in cfg:
            if not isinstance(cfg["branding"], dict):
                raise ValueError("branding debe ser un objeto")
            for k in ("hotel", "tagline"):
                if k in cfg["branding"] and not isinstance(cfg["branding"][k], str):
                    raise ValueError(f"branding.{k} debe ser texto")
        if "max_days" in cfg:
            try:
                md = int(cfg["max_days"])
            except Exception:
                raise ValueError("max_days debe ser entero 1-30")
            if md < 1 or md > 30:
                raise ValueError("max_days debe estar entre 1 y 30")
            cfg["max_days"] = md
        if "max_days_full" in cfg:
            try:
                mdf = int(cfg["max_days_full"])
            except Exception:
                raise ValueError("max_days_full debe ser entero 1-30")
            if mdf < 1 or mdf > 30:
                raise ValueError("max_days_full debe estar entre 1 y 30")
            cfg["max_days_full"] = mdf
        if "idle_timeout_seconds" in cfg:
            try:
                it = int(cfg["idle_timeout_seconds"])
            except Exception:
                raise ValueError("idle_timeout_seconds debe ser entero 10-600")
            if it < 10 or it > 600:
                raise ValueError("idle_timeout_seconds debe estar entre 10 y 600")
            cfg["idle_timeout_seconds"] = it
        if "promos" in cfg and not isinstance(cfg["promos"], list):
            raise ValueError("promos debe ser una lista")
        if "suite_durations" in cfg and not isinstance(cfg["suite_durations"], dict):
            raise ValueError("suite_durations debe ser un objeto")
        if "qr_url" in cfg and not isinstance(cfg["qr_url"], str):
            raise ValueError("qr_url debe ser texto")
        if "reserva_tarifa" in cfg:
            try:
                rt = float(cfg["reserva_tarifa"])
                if rt < 0 or rt > 1000:
                    raise ValueError
            except Exception:
                raise ValueError("reserva_tarifa debe ser número 0-1000")
            cfg["reserva_tarifa"] = rt
        if "assign_ttl_minutes" in cfg:
            try:
                at = int(cfg["assign_ttl_minutes"])
            except Exception:
                raise ValueError("assign_ttl_minutes debe ser entero 5-120")
            if at < 5 or at > 120:
                raise ValueError("assign_ttl_minutes debe estar entre 5 y 120")
            cfg["assign_ttl_minutes"] = at
        if "cleaning_sla_minutes" in cfg:
            try:
                sla = int(cfg["cleaning_sla_minutes"])
            except (TypeError, ValueError):
                raise ValueError("cleaning_sla_minutes debe ser un entero entre 10 y 240")
            if sla < 10 or sla > 240:
                raise ValueError("cleaning_sla_minutes debe estar entre 10 y 240 minutos")
            cfg["cleaning_sla_minutes"] = sla
        # Nuevas claves del kiosco: se deep-mergean bajo el sub-objeto "kiosco"
        # para no pisar otras claves de config ajenas.
        kiosco_keys = ("price_overrides", "qr_url", "idle_timeout_seconds", "promos",
                       "max_days", "max_days_full", "suite_durations", "branding")
        kiosco_updates = {k: cfg.pop(k) for k in list(cfg) if k in kiosco_keys}
        hotel_id = self._hotel_id(sess)
        conn = self._conn(sess)
        try:
            row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s FOR UPDATE", (hotel_id,))
            current = dict(row["config"] or {}) if row else {}
            # Cargar sub-objeto kiosco existente (o crear uno nuevo).
            kiosco_now = current.get("kiosco")
            kiosco_now = kiosco_now if isinstance(kiosco_now, dict) else {}
            if kiosco_updates:
                for k, v in kiosco_updates.items():
                    if isinstance(v, (dict, list)):
                        prev = kiosco_now.get(k)
                        if isinstance(prev, dict) and isinstance(v, dict):
                            merged = dict(prev)
                            merged.update(v)
                            kiosco_now[k] = merged
                        else:
                            kiosco_now[k] = v
                    else:
                        kiosco_now[k] = v
            # Mezclar el resto de claves (las de settings clásicos) a primer nivel.
            final = dict(current)
            final.update(cfg)  # claves clásicas (incluye cleaning_sla_minutes, etc.)
            if kiosco_updates or "kiosco" in final:
                final["kiosco"] = kiosco_now
            db_exec(
                conn,
                "UPDATE hotels SET config = %s::jsonb WHERE id = %s",
                (json.dumps(final), hotel_id),
            )
            audit(conn, hotel_id, "actualizar_config", None, None, sess["username"],
                  f"Configuración actualizada: {json.dumps(final, ensure_ascii=False)}")
            conn.commit()
            fresh = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (hotel_id,))
            saved = dict(fresh["config"] or {}) if fresh else {}
        except Exception:
            conn.rollback()
            raise
        finally:
            release_conn(conn)
        saved.setdefault("reserva_tarifa", 0)
        saved.setdefault("assign_ttl_minutes", 30)
        saved.setdefault("cleaning_sla_minutes", 60)
        self._send(200, {"config": saved})

    def get_audit(self):
        qs = self._qs()
        try:
            limit = int((qs.get("limit") or ["100"])[0])
        except ValueError:
            raise ValueError("limit debe ser un entero")
        limit = max(1, min(limit, 500))
        try:
            offset = int((qs.get("offset") or ["0"])[0])
        except ValueError:
            raise ValueError("offset debe ser un entero")
        if offset < 0:
            raise ValueError("offset debe ser un entero >= 0")
        action = (qs.get("action") or [""])[0].strip()
        from_raw = (qs.get("from") or [""])[0].strip()
        to_raw = (qs.get("to") or [""])[0].strip()
        where, params = [], []
        if action:
            where.append("action = %s")
            params.append(action)
        if from_raw:
            from_dt = parse_date_local(from_raw, "from")
            where.append("created_at >= %s")
            params.append(from_dt)
        if to_raw:
            to_dt = parse_date_local(to_raw, "to") + timedelta(days=1)
            where.append("created_at < %s")
            params.append(to_dt)
        where_sql = ("WHERE " + " AND ".join(where)) if where else ""
        conn = self._conn()
        try:
            total = int(fetch_one(conn, f"SELECT COUNT(*) AS n FROM audit_log {where_sql}", params)["n"])
            rows = fetch_all(
                conn,
                f"SELECT * FROM audit_log {where_sql} ORDER BY id DESC LIMIT %s OFFSET %s",
                params + [limit, offset],
            )
            audit_rows = []
            for r in rows:
                d = dict(r)
                d["created_at"] = local_str(r["created_at"])
                audit_rows.append(d)
        finally:
            release_conn(conn)
        self._send(200, {"audit": audit_rows, "total": total, "limit": limit, "offset": offset})

    def master_hotels(self):
        conn = self._conn(master=True)
        try:
            rows = fetch_all(
                conn,
                """
                SELECT h.id, h.slug, h.nombre, h.activo,
                       COUNT(r.id) AS rooms_total,
                       COUNT(r.id) FILTER (WHERE r.status = 'libre') AS libres,
                       COUNT(r.id) FILTER (WHERE r.status = 'ocupado') AS ocupadas,
                       COUNT(r.id) FILTER (WHERE r.status = 'en_limpieza') AS en_limpieza,
                       COUNT(r.id) FILTER (WHERE r.status = 'bloqueado') AS bloqueadas
                FROM hotels h
                LEFT JOIN rooms r ON r.hotel_id = h.id
                GROUP BY h.id, h.slug, h.nombre, h.activo
                ORDER BY h.id
                """
            )
            hotels = []
            for r in rows:
                total = int(r["rooms_total"])
                ocupadas = int(r["ocupadas"])
                hotels.append({
                    "id": r["id"],
                    "slug": r["slug"],
                    "nombre": r["nombre"],
                    "activo": bool(r["activo"]),
                    "rooms_total": total,
                    "libres": int(r["libres"]),
                    "ocupadas": ocupadas,
                    "en_limpieza": int(r["en_limpieza"]),
                    "bloqueadas": int(r["bloqueadas"]),
                    "ocupacion_pct": round(ocupadas / total * 100, 1) if total else 0,
                })
        finally:
            release_conn(conn)
        self._send(200, {"hotels": hotels})

    def master_dashboard(self):
        now_dt = now()
        day_start = datetime(now_dt.year, now_dt.month, now_dt.day, tzinfo=ECUADOR_TZ)
        day_end = day_start + timedelta(days=1)
        conn = self._conn(master=True)
        try:
            room_rows = fetch_all(
                conn,
                """
                SELECT r.hotel_id, COUNT(r.id) AS rooms_total,
                       COUNT(r.id) FILTER (WHERE r.status = 'libre') AS libres,
                       COUNT(r.id) FILTER (WHERE r.status = 'ocupado') AS ocupadas,
                       COUNT(r.id) FILTER (WHERE r.status = 'en_limpieza') AS en_limpieza,
                       COUNT(r.id) FILTER (WHERE r.status = 'bloqueado') AS bloqueadas
                FROM rooms r GROUP BY r.hotel_id
                """
            )
            hotel_rows = fetch_all(conn, "SELECT id, nombre FROM hotels WHERE activo ORDER BY id")
            hotel_by_id = {h["id"]: h for h in hotel_rows}

            ingresos_rows = fetch_all(
                conn,
                "SELECT o.hotel_id, SUM(p.amount_cents) AS m FROM payments p "
                "JOIN orders o ON o.id = p.order_id "
                "WHERE p.paid_at >= %s AND p.paid_at < %s GROUP BY o.hotel_id",
                (day_start, day_end),
            )
            ingresos_by_hotel = {}
            for r in ingresos_rows:
                if r["hotel_id"] is not None:
                    ingresos_by_hotel[r["hotel_id"]] = round(num(r["m"]) / 100, 2)

            def _counts(sql, *params):
                out = {}
                for r in fetch_all(conn, sql, params):
                    if r["hotel_id"] is not None:
                        out[r["hotel_id"]] = int(r["n"])
                return out

            pendientes = _counts(
                "SELECT hotel_id, COUNT(*) AS n FROM orders WHERE status = 'pendiente' AND product != 'reserva' GROUP BY hotel_id"
            )
            to_assign = _counts(
                "SELECT hotel_id, COUNT(*) AS n FROM orders WHERE status = 'por_asignar' GROUP BY hotel_id"
            )
            salidas = _counts(
                "SELECT hotel_id, COUNT(*) AS n FROM orders WHERE status IN ('pagado', 'confirmada') AND check_out < %s GROUP BY hotel_id",
                now_dt,
            )

            room_by_hotel = {}
            for r in room_rows:
                room_by_hotel[r["hotel_id"]] = r

            por_hotel = []
            for h in hotel_rows:
                hid = h["id"]
                rr = room_by_hotel.get(hid) or {}
                total = int(rr.get("rooms_total") or 0)
                ocupadas = int(rr.get("ocupadas") or 0)
                por_hotel.append({
                    "id": hid,
                    "nombre": h["nombre"],
                    "ocupadas": ocupadas,
                    "en_limpieza": int(rr.get("en_limpieza") or 0),
                    "ingresos_hoy": ingresos_by_hotel.get(hid, 0.0),
                    "pagos_pendientes": pendientes.get(hid, 0),
                    "to_assign": to_assign.get(hid, 0),
                    "salidas_vencidas": salidas.get(hid, 0),
                })

            pagos_rows = fetch_all(
                conn,
                "SELECT p.method, SUM(p.amount_cents) AS m FROM payments p "
                "WHERE p.paid_at >= %s AND p.paid_at < %s GROUP BY p.method",
                (day_start, day_end),
            )
            pagos_hoy = {"efectivo": 0.0, "transferencia": 0.0}
            ingresos_hoy = 0.0
            for r in pagos_rows:
                m = round(num(r["m"]) / 100, 2)
                ingresos_hoy += m
                pagos_hoy[r["method"]] = pagos_hoy.get(r["method"], 0.0) + m

            por_producto = []
            for r in fetch_all(
                conn,
                "SELECT o.product, COUNT(*) AS n, SUM(p.amount_cents) AS m FROM payments p "
                "JOIN orders o ON o.id = p.order_id "
                "WHERE p.paid_at >= %s AND p.paid_at < %s GROUP BY o.product ORDER BY o.product",
                (day_start, day_end),
            ):
                prod = r["product"]
                por_producto.append({
                    "product": prod,
                    "label": PRODUCT_LABELS.get(prod, prod),
                    "count": int(r["n"]),
                    "total": round(num(r["m"]) / 100, 2),
                })

            limpieza_pendiente = int(fetch_one(
                conn, "SELECT COUNT(*) AS n FROM cleaning_tasks WHERE status = 'pendiente'"
            )["n"])

            totales = {
                "hoteles": len(por_hotel),
                "cuartos": sum(int((room_by_hotel.get(h["id"]) or {}).get("rooms_total") or 0) for h in hotel_rows),
                "libres": sum(int((room_by_hotel.get(h["id"]) or {}).get("libres") or 0) for h in hotel_rows),
                "ocupadas": sum(int((room_by_hotel.get(h["id"]) or {}).get("ocupadas") or 0) for h in hotel_rows),
                "en_limpieza": sum(int((room_by_hotel.get(h["id"]) or {}).get("en_limpieza") or 0) for h in hotel_rows),
                "bloqueadas": sum(int((room_by_hotel.get(h["id"]) or {}).get("bloqueadas") or 0) for h in hotel_rows),
            }
            totales["ocupacion_pct"] = round(
                totales["ocupadas"] / totales["cuartos"] * 100, 1
            ) if totales["cuartos"] else 0
        finally:
            release_conn(conn)
        self._send(200, {
            "as_of": now_dt.isoformat(),
            "totales": totales,
            "por_hotel": por_hotel,
            "ingresos_hoy": round(ingresos_hoy, 2),
            "pagos_hoy": {k: round(v, 2) for k, v in pagos_hoy.items()},
            "por_producto": por_producto,
            "salidas_vencidas": sum(p["salidas_vencidas"] for p in por_hotel),
            "limpieza_pendiente": limpieza_pendiente,
        })

    def master_orders(self):
        qs = self._qs()
        hotel_raw = (qs.get("hotel_id") or [""])[0].strip()
        status = (qs.get("status") or [""])[0].strip()
        from_raw = (qs.get("from") or [""])[0].strip()
        to_raw = (qs.get("to") or [""])[0].strip()
        try:
            limit = int((qs.get("limit") or ["50"])[0])
            page = int((qs.get("page") or ["1"])[0])
        except ValueError:
            raise ValueError("limit y page deben ser enteros")
        limit = max(1, min(limit, 200))
        page = max(1, page)
        hotel_id = None
        if hotel_raw:
            try:
                hotel_id = int(hotel_raw)
            except ValueError:
                raise ValueError("hotel_id debe ser un entero")
        if status and status not in ORDER_STATUSES:
            raise ValueError("status inválido")

        where, params = [], []
        if hotel_id is not None:
            where.append("o.hotel_id = %s")
            params.append(hotel_id)
        if status:
            where.append("o.status = %s")
            params.append(status)
        if from_raw:
            from_dt = parse_date_local(from_raw, "from")
            where.append("o.created_at >= %s")
            params.append(from_dt)
        if to_raw:
            to_dt = parse_date_local(to_raw, "to") + timedelta(days=1)
            where.append("o.created_at < %s")
            params.append(to_dt)
        where_sql = ("WHERE " + " AND ".join(where)) if where else ""

        conn = self._conn(master=True)
        try:
            total = int(fetch_one(
                conn,
                f"SELECT COUNT(*) AS n FROM orders o {where_sql}",
                params,
            )["n"])
            pages = max(1, math.ceil(total / limit)) if total else 1
            page = min(page, pages)
            offset = (page - 1) * limit
            rows = fetch_all(
                conn,
                f"""
                SELECT o.*, h.nombre AS hotel_name, r.number AS room_number
                FROM orders o JOIN hotels h ON h.id = o.hotel_id
                LEFT JOIN rooms r ON r.id = o.room_id
                {where_sql}
                ORDER BY o.id DESC LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            result = [self._order_dict(conn, r) for r in rows]
        finally:
            release_conn(conn)
        self._send(200, {"orders": result, "total": total, "page": page, "pages": pages})

    def _serve_upload(self, path):
        rel = path[len("/uploads/"):]
        target = os.path.realpath(os.path.join(STORAGE_DIR, rel))
        if os.path.commonpath([target, os.path.realpath(STORAGE_DIR)]) != os.path.realpath(STORAGE_DIR):
            self._error(404, "Archivo no encontrado")
            return
        if not os.path.isfile(target):
            self._error(404, "Archivo no encontrado")
            return
        ext = os.path.splitext(target)[1].lower()
        ctype = "application/octet-stream"
        if ext in (".jpg", ".jpeg"):
            ctype = "image/jpeg"
        elif ext == ".png":
            ctype = "image/png"
        with open(target, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_img(self, path):
        name = path.split("/")[-1]
        target = os.path.join(WEB_DIR, "hotel-imagenes", name)
        if not os.path.isfile(target):
            self._error(404, "Imagen no encontrada")
            return
        ctype = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(
            os.path.splitext(name)[1].lower(), "application/octet-stream"
        )
        with open(target, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        self.wfile.write(body)

    def _load_apk(self, target):
        """Lee el APK una vez y lo cachea en RAM; lo relee solo si el archivo cambió."""
        global _APK_CACHE
        try:
            mtime = os.path.getmtime(target)
        except OSError:
            mtime = 0.0
        cached = _APK_CACHE
        if cached["path"] == target and cached["mtime"] == mtime and cached["bytes"] is not None:
            return cached["bytes"]
        with open(target, "rb") as f:
            data = f.read()
        _APK_CACHE = {"path": target, "mtime": mtime, "bytes": data}
        return data

    def _serve_apk(self, target):
        apk = self._load_apk(target)
        self.send_response(200)
        self.send_header("Content-Type", "application/vnd.android-package-archive")
        self.send_header("Content-Disposition", 'attachment; filename="kiosco.apk"')
        self.send_header("Content-Length", str(len(apk)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Accept-Ranges", "none")
        self.end_headers()
        # Envío directo desde RAM en un solo write (rápido, sin I/O de disco por request).
        self.wfile.write(apk)

    def _serve_static(self, path):
        base = WEB_MASTER_DIR if self.MODE == "master" else WEB_DIR
        name = self._static_map().get(path)
        if not name:
            self._error(404, "Ruta no encontrada")
            return
        target = os.path.join(base, name)
        if not os.path.isfile(target):
            self._error(404, "Página no construida todavía")
            return
        ext = os.path.splitext(target)[1]
        if ext == ".apk":
            self._serve_apk(target)
            return
        ctype = {".html": "text/html", ".js": "application/javascript", ".css": "text/css"}.get(
            ext, "application/octet-stream"
        )
        with open(target, "rb") as f:
            body = f.read()
        self.send_response(200)
        if ext == ".html":
            self.send_header("Content-Type", "text/html; charset=utf-8")
        else:
            self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.end_headers()
        self.wfile.write(body)

    def _serve_react_spa(self, path):
        """Sirve archivos del React SPA en kiosco/dist/."""
        base = WEB_DIR
        # Remover /kiosco/ prefix y buscar en kiosco/dist/
        rel = path[len("/kiosco/"):]
        if not rel:
            rel = "index.html"
        target = os.path.join(base, "kiosco", "dist", rel)
        if not os.path.isfile(target):
            # SPA fallback: servir index.html para rutas de React Router
            target = os.path.join(base, "kiosco", "dist", "index.html")
        if not os.path.isfile(target):
            self._error(404, "React SPA no construida todavía")
            return
        ext = os.path.splitext(target)[1]
        ctype = {
            ".html": "text/html", ".js": "application/javascript",
            ".css": "text/css", ".json": "application/json",
            ".svg": "image/svg+xml", ".png": "image/png",
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".ico": "image/x-icon", ".woff2": "font/woff2",
            ".woff": "font/woff", ".ttf": "font/ttf",
        }.get(ext, "application/octet-stream")
        with open(target, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        # Assets con hash pueden cache agresivo; HTML no
        if ext != ".html":
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        self.wfile.write(body)


def _bootstrap():
    """init_db idempotente en el primer arranque; falla silencioso si la conexión no tiene DDL."""
    for attempt in range(3):
        try:
            init_db()
            print(f"[init] base de datos lista (hotel_id={HOTEL_ID if APP_MODE != 'master' else 'master'})", flush=True)
            return
        except Exception as e:
            print(f"[init] intento {attempt + 1}/3 falló: {e}", flush=True)
            time.sleep(2)


def main():
    _bootstrap()
    # Re-emite pg_notify del kiosco a los clientes SSE locales; activo en admin y master.
    if APP_MODE in ("admin", "master"):
        notify = threading.Thread(target=notify_listener_loop, name="cyhotel-notify", daemon=True)
        notify.start()
    if APP_MODE == "admin":
        worker = threading.Thread(target=worker_loop, name="cyhotel-worker", daemon=True)
        worker.start()
        print(f"[worker] hilo de vencimientos activo (cada {WORKER_INTERVAL}s)", flush=True)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    try:
        server.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        # Búfer de envío grande: el APK (50MB) se entrega en menos vueltas de red.
        server.socket.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 2 * 1024 * 1024)
    except Exception:
        pass
    print(f"CyHotel API ({APP_MODE}) en http://localhost:{PORT}", flush=True)
    if APP_MODE == "kiosco":
        print(f"  Kiosco: http://localhost:{PORT}/kiosco", flush=True)
    elif APP_MODE == "admin":
        print(f"  Admin:  http://localhost:{PORT}/admin", flush=True)
    else:
        print(f"  Master: http://localhost:{PORT}/master", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido")


if __name__ == "__main__":
    main()
