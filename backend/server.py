"""API multi-modo (kiosco/admin/master) sobre PostgreSQL multi-tenant; cada conexión aplica RLS vía set_app_hotel().

Fase 3: Handler DELGADO — delega dominio a backend/app/routes/* (que usan
backend/app/services/*). Aquí solo: arranque/env, formato no-dominio,
infra SSE/NOTIFY/worker, auth/conexión/envío, dispatch por tablas y Fase B
(estáticos/SW/APK/health/update/crash). Imports duros: falla en boot si rompe.
"""

import hashlib
import json
import os
import socket
import sys
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
# Runtime usa cyhotel_app (no-superuser, sujeto a FORCE RLS). Superuser solo para init_db vía CYHOTEL_DB_SUPERUSER.
if _parsed.username and _parsed.username == "cyhotel_app":
    os.environ["CYHOTEL_DB_USER"] = _parsed.username
    if _parsed.password:
        os.environ["CYHOTEL_DB_PASSWORD"] = _parsed.password

from db import (  # noqa: E402
    db, release_conn, set_app_hotel, init_db,
    exec as db_exec, fetch_one, fetch_all,
    ROOM_TYPES, AMANECIDA_ENTRY, AMANECIDA_EXIT, HOLD_MINUTES,
)
from worker import worker_loop  # noqa: E402

# Fase 3: imports duros (sin fallback silencioso; fallar en boot si algo rompe).
from app.services import auth as _auth_svc  # noqa: E402
from app.routes.common import ApiError, RouteCtx  # noqa: E402
from app.routes import kiosco as _r_kiosco  # noqa: E402
from app.routes import admin as _r_admin  # noqa: E402
from app.routes import master as _r_master  # noqa: E402

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

# Sesiones legacy (compat; fuente real: app.services.auth PG). Se conserva el nombre.
sessions = {}

# Broadcast SSE global de eventos en tiempo real.
SSE_CLIENTS = set()
SSE_LOCK = threading.Lock()

# Canal pg_notify entre procesos: el kiosco notifica y admin/master re-emiten a sus clientes SSE.
PG_NOTIFY_CHANNEL = "cyhotel_changed"

# Caché en memoria del APK: se lee del disco una sola vez y se sirve desde RAM en cada
# descarga de actualización (evita I/O de disco por request y maximiza la velocidad de envío).
_APK_CACHE = {"path": None, "mtime": 0.0, "bytes": None, "sha256": None, "size": None}

# Lock global para el check+read del APK (raza en ThreadingHTTPServer).
_APK_LOCK = threading.Lock()


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


# ---------------------------------------------------------------------------
# Tablas de dispatch Fase 3: (nombre, modos, match, roles, scope, handler, master, critical)
# Mismos guards que los if/elif originales: modo + auth + prefijos exactos.
# ---------------------------------------------------------------------------

def _ex(path):
    return lambda p: p == path


def _starts(prefix):
    return lambda p: p.startswith(prefix)


def _order_action(suffix):
    return lambda p: p.startswith("/api/orders/") and p.endswith(suffix)


def _room_status_path(p):
    return p.startswith("/api/rooms/") and p.endswith("/status")


def _hk_task_action(suffix):
    return lambda p: p.startswith("/api/housekeeping/tasks/") and p.endswith(suffix)


def _staff_deactivate_path(p):
    return p.startswith("/api/housekeeping/staff/") and p.endswith("/deactivate")


def _incidence_resolve_path(p):
    return p.startswith("/api/incidences/") and p.endswith("/resolve")


# GET: dominio (los Fase B/estáticos se sirven inline fuera de la tabla).
GET_ROUTES = [
    ("catalog", ("kiosco", "admin"), _ex("/api/catalog"), None, None, _r_kiosco.get_catalog, False, False),
    ("types", ("kiosco", "admin"), _ex("/api/types"), None, None, _r_kiosco.get_types, False, False),
    ("kiosco-config", ("kiosco", "admin", "master"), _ex("/api/kiosco-config"), None, None, _r_kiosco.get_kiosco_config, False, False),
    ("admin-me", ("kiosco", "admin", "master"), _ex("/api/admin/me"), None, None, _r_admin.me, False, False),
    ("master-hotels", ("master",), _ex("/api/master/hotels"), None, "master", _r_master.get_hotels, True, False),
    ("master-dashboard", ("master",), _ex("/api/master/dashboard"), None, "master", _r_master.get_dashboard, True, False),
    ("master-orders", ("master",), _ex("/api/master/orders"), None, "master", _r_master.list_orders, True, False),
    ("rooms", ("admin",), _ex("/api/rooms"), ROLES_ROOMS, "hotel", _r_admin.list_rooms, False, False),
    ("rooms-available", ("admin",), _ex("/api/rooms/available"), ROLES_ROOMS, "hotel", _r_admin.list_rooms_available, False, False),
    ("orders", ("admin",), _ex("/api/orders"), ROLES_ORDERS, "hotel", _r_admin.list_orders, False, False),
    ("order-detail", ("admin",), _starts("/api/orders/"), ROLES_ORDERS, "hotel", _r_admin.get_order_detail, False, False),
    ("reservations", ("admin",), _ex("/api/reservations"), ROLES_ORDERS, "hotel", _r_admin.list_reservations, False, False),
    ("audit", ("admin",), _ex("/api/audit"), ROLES_AUDIT, "hotel", _r_admin.get_audit, False, False),
    ("overview", ("admin",), _ex("/api/dashboard/overview"), ROLES_OVERVIEW, "hotel", _r_admin.dashboard_overview, False, False),
    ("occupancy", ("admin",), _ex("/api/dashboard/occupancy"), ROLES_OCCUPANCY, "hotel", _r_admin.dashboard_occupancy, False, False),
    ("close-report", ("admin",), _ex("/api/dashboard/close-report"), ROLES_OVERVIEW, "hotel", _r_admin.close_report, False, False),
    ("daily-report", ("admin",), _ex("/api/dashboard/daily-report"), ROLES_AUDIT, "hotel", _r_admin.daily_report, False, False),
    ("alerts", ("admin",), _ex("/api/dashboard/alerts"), None, "hotel", _r_admin.dashboard_alerts, False, False),
    ("settings-get", ("admin",), _ex("/api/hotel/settings"), ROLES_SETTINGS_GET, "hotel", _r_admin.get_settings, False, False),
    ("hk-tasks", ("admin",), _ex("/api/housekeeping/tasks"), ROLES_STAFF, "hotel", _r_admin.list_tasks, False, False),
    ("hk-staff", ("admin",), _ex("/api/housekeeping/staff"), ROLES_STAFF, "hotel", _r_admin.list_staff, False, False),
    ("incidences", ("admin",), _ex("/api/incidences"), ROLES_INCIDENCES, "hotel", _r_admin.list_incidences, False, False),
]

# POST: dominio (login/logout/órdenes/limpieza/settings; crash es Fase B inline).
POST_ROUTES = [
    ("login", ("admin", "master"), _ex("/api/admin/login"), None, None, _r_admin.login, "auto", False),
    ("pin-login", ("admin", "master"), _ex("/api/admin/pin-login"), None, None, _r_admin.pin_login, "auto", False),
    ("logout", ("admin", "master"), _ex("/api/admin/logout"), "any", None, _r_admin.logout, "auto", False),
    ("create-order", ("kiosco", "admin"), _ex("/api/orders"), None, None, _r_kiosco.create_order, False, False),
    ("assign", ("admin",), _order_action("/assign"), ROLES_PAY, "hotel", _r_admin.assign_order, False, True),
    ("pay", ("admin",), _order_action("/pay"), ROLES_PAY, "hotel", _r_admin.pay_order, False, True),
    ("cancel", ("admin",), _order_action("/cancel"), ROLES_PAY, "hotel", _r_admin.cancel_order, False, True),
    ("checkout", ("admin",), _order_action("/checkout"), ROLES_PAY, "hotel", _r_admin.checkout_order, False, True),
    ("extend", ("admin",), _order_action("/extend"), ROLES_PAY, "hotel", _r_admin.extend_order, False, True),
    ("room-status", ("admin",), _room_status_path, ROLES_ROOM_STATUS, "hotel", _r_admin.set_room_status, False, True),
    ("hk-start", ("admin",), _hk_task_action("/start"), ROLES_HOUSEKEEPING, "hotel", _r_admin.start_task, False, True),
    ("hk-assign-staff", ("admin",), _hk_task_action("/assign-staff"), ROLES_STAFF, "hotel", _r_admin.assign_staff, False, True),
    ("hk-staff-create", ("admin",), _ex("/api/housekeeping/staff"), ROLES_STAFF, "hotel", _r_admin.create_staff, False, False),
    ("hk-staff-deactivate", ("admin",), _staff_deactivate_path, ROLES_STAFF, "hotel", _r_admin.deactivate_staff, False, False),
    ("hk-complete", ("admin",), _hk_task_action("/complete"), ROLES_HOUSEKEEPING, "hotel", _r_admin.complete_task, False, True),
    ("hk-incident", ("admin",), _hk_task_action("/incident"), ROLES_HOUSEKEEPING, "hotel", _r_admin.report_incident, False, True),
    ("incidence-resolve", ("admin",), _incidence_resolve_path, ROLES_INCIDENCES, "hotel", _r_admin.resolve_incidence, False, True),
    ("settings-post", ("admin",), _ex("/api/hotel/settings"), ROLES_SETTINGS_POST, "hotel", _r_admin.post_settings, False, False),
]


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
        sess = _auth_svc.get_session(token)
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
        sess = _auth_svc.get_session(token)
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

    # ---------------------------------------------------------- dispatch ---

    def _match_route(self, table, path):
        for entry in table:
            _name, modes, match, _roles, _scope, _fn, _master, _critical = entry
            if self.MODE not in modes:
                continue
            try:
                if match(path):
                    return entry
            except Exception:
                continue
        return None

    def _handle_route(self, fn, conn, sess, hotel_id, data, qs, path, critical=False):
        """Ejecuta router con ctx explícito; mapea ApiError->HTTP y reintenta deadlock."""
        ctx = RouteCtx(conn, sess, hotel_id, data, qs, path, self.MODE)
        try:
            ctx.token = self._bearer_token()
        except Exception:
            ctx.token = ""
        attempts = DEADLOCK_RETRIES if critical else 1
        last_exc = None
        for attempt in range(attempts):
            try:
                status, payload = fn(ctx)
                for ev, ed in list(ctx.broadcasts):
                    sse_broadcast(ev, ed)
                self._send(status, payload)
                return
            except ApiError as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                self._error(e.code, e.message)
                return
            except ValueError as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                self._error(400, str(e))
                return
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                if _is_retryable_pg(e) and attempt < attempts - 1:
                    last_exc = e
                    try:
                        ctx.broadcasts.clear()
                    except Exception:
                        pass
                    time.sleep(DEADLOCK_BACKOFF_MS[min(attempt, len(DEADLOCK_BACKOFF_MS) - 1)])
                    continue
                self._error(500, str(e))
                return
        if last_exc is not None:
            self._error(500, f"Concurrencia en base de datos: {last_exc}")

    def _master_auth(self):
        if self.MODE != "master":
            self._error(404, "Ruta no encontrada")
            return None
        return self._require_auth(scope="master")

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
                return
            if path == "/api/kiosco-version":
                self.kiosco_version()
                return
            if path == "/api/kiosco-update":
                self.kiosco_update()
                return
            if path == "/api/docs.yaml":
                self.serve_openapi()
                return
            route = self._match_route(GET_ROUTES, path)
            if route is not None:
                _name, _modes, _match, roles, scope, fn, master_flag, _critical = route
                if master_flag is True:
                    if not self._master_auth():
                        return
                    sess = self._require_auth(scope="master")
                    if not sess:
                        return
                    conn = self._conn(sess, master=True)
                    try:
                        self._handle_route(fn, conn, sess, None, {}, self._qs(), path, critical=False)
                    finally:
                        release_conn(conn)
                    return
                if roles is None and scope is None:
                    # Pública (catalog/types/kiosco-config) o me (auth sin roles).
                    if _name == "admin-me":
                        sess = self._require_auth()
                        if not sess:
                            return
                        conn = self._conn(sess)
                        try:
                            self._handle_route(fn, conn, sess, self._hotel_id(sess), {}, self._qs(), path, critical=False)
                        finally:
                            release_conn(conn)
                        return
                    conn = self._conn()
                    try:
                        self._handle_route(fn, conn, None, self._hotel_id(None), {}, self._qs(), path, critical=False)
                    finally:
                        release_conn(conn)
                    return
                sess = self._require_auth(roles, scope)
                if not sess:
                    return
                conn = self._conn(sess)
                try:
                    self._handle_route(fn, conn, sess, self._hotel_id(sess), {}, self._qs(), path, critical=False)
                finally:
                    release_conn(conn)
                return
            if path.startswith("/uploads/"):
                self._serve_upload(path)
            elif path.startswith("/img/"):
                self._serve_img(path)
            elif path.startswith("/kiosco/"):
                self._serve_react_spa(path)
            elif path == "/tokens.css":
                self._serve_tokens()
            elif path in self._static_map():
                self._serve_static(path)
            else:
                self._error(404, "Ruta no encontrada")
        except ValueError as e:
            self._error(400, str(e))
        except Exception as e:
            self._error(500, str(e))

    def do_POST(self):
        path = unquote(urlparse(self.path).path).rstrip("/") or "/"
        try:
            data = self._body()
        except ValueError as e:
            self._error(400, str(e))
            return
        except Exception as e:
            self._error(500, str(e))
            return
        try:
            if path == "/api/kiosco-crash":
                self.kiosco_crash(data)
                return
            route = self._match_route(POST_ROUTES, path)
            if route is None:
                self._error(404, "Ruta no encontrada")
                return
            _name, _modes, _match, roles, scope, fn, master_flag, critical = route
            if _name in ("login", "pin-login"):
                is_master = (self.MODE == "master")
                conn = self._conn(master=is_master)
                try:
                    hotel_id = None if is_master else self.HOTEL
                    self._handle_route(fn, conn, None, hotel_id, data, self._qs(), path, critical=False)
                finally:
                    release_conn(conn)
                return
            if _name == "logout":
                sess = self._require_auth()
                if not sess:
                    return
                conn = self._conn(sess, master=bool(sess and sess.get("scope") == "master"))
                try:
                    self._handle_route(fn, conn, sess, self._hotel_id(sess), data, self._qs(), path, critical=False)
                finally:
                    release_conn(conn)
                return
            if _name == "create-order":
                conn = self._conn()
                try:
                    self._handle_route(fn, conn, None, self.HOTEL, data, self._qs(), path, critical=False)
                finally:
                    release_conn(conn)
                return
            # Admin autenticadas (master_flag False, scope hotel).
            if roles == "any":
                sess = self._require_auth()
            else:
                sess = self._require_auth(roles, scope)
            if not sess:
                return
            conn = self._conn(sess)
            try:
                self._handle_route(fn, conn, sess, self._hotel_id(sess), data, self._qs(), path, critical=critical)
            finally:
                release_conn(conn)
            return
        except ValueError as e:
            self._error(400, str(e))
        except Exception as e:
            self._error(500, str(e))

    # ------------------------------------------------------------- Fase B ---
    # Estáticos/SW/APK/health/update/crash: sin cambios (no tocar en Fase 3).

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
            if payload.get("version") is None:
                print(f"[kiosco-version] chequeo fallido: manifiesto ausente o sin version: {p}", file=sys.stderr, flush=True)
                self._error(503, "Versión del kiosco no disponible")
                return
            self._send(200, payload)
        except Exception as e:
            print(f"[kiosco-version] chequeo fallido: {e}", file=sys.stderr, flush=True)
            self._error(500, "No se pudo leer la versión")

    def kiosco_update(self):
        """Endpoint de actualización local: devuelve versión + URL de descarga del servidor."""
        try:
            p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "kiosco-version.json")
            if os.path.exists(p):
                with open(p, "r") as f:
                    data = json.load(f)
            else:
                print(f"[kiosco-update] chequeo fallido: manifiesto ausente: {p}", file=sys.stderr, flush=True)
                data = {"version": None}
            version = data.get("version")
            if version is None:
                print(f"[kiosco-update] chequeo fallido: manifiesto sin version: {p}", file=sys.stderr, flush=True)
            version_code = data.get("versionCode")
            min_version = data.get("minVersion")
            apk_route = data.get("apk") or "/kiosco.apk"
            # Construir URL de descarga apuntando al servidor local, con el esquema
            # del request (tras un proxy TLS el servidor ve http; X-Forwarded-Proto lo corrige).
            proto = (self.headers.get("X-Forwarded-Proto") or "").split(",")[0].strip() or "http"
            host = self.headers.get("Host", "localhost")
            download_url = f"{proto}://{host}/kiosco.apk"
            # sha256/size del APK, cacheados por mtime vía _load_apk; si falta → null/false sin fallar.
            sha256 = None
            size = None
            apk_available = False
            try:
                apk_file = os.path.join(WEB_DIR, "kiosco.apk")
                self._load_apk(apk_file)
                with _APK_LOCK:
                    sha256 = _APK_CACHE.get("sha256")
                    size = _APK_CACHE.get("size")
                apk_available = True
            except OSError as e:
                print(f"[kiosco-update] chequeo fallido: APK no disponible: {e}", file=sys.stderr, flush=True)
                sha256 = None
                size = None
                apk_available = False
            self._send(200, {
                "version": version,
                "versionCode": version_code,
                "minVersion": min_version,
                "download_url": download_url,
                "apk": apk_route,
                "sha256": sha256,
                "size": size,
                "apkAvailable": apk_available,
            })
        except Exception as e:
            print(f"[kiosco-update] chequeo fallido: {e}", file=sys.stderr, flush=True)
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
        with _APK_LOCK:
            try:
                mtime = os.path.getmtime(target)
            except OSError:
                mtime = 0.0
            cached = _APK_CACHE
            if cached["path"] == target and cached["mtime"] == mtime and cached["bytes"] is not None:
                return cached["bytes"]
            with open(target, "rb") as f:
                data = f.read()
            _APK_CACHE = {
                "path": target,
                "mtime": mtime,
                "bytes": data,
                "sha256": hashlib.sha256(data).hexdigest(),
                "size": len(data),
            }
            return data

    def _serve_apk(self, target):
        try:
            apk = self._load_apk(target)
        except OSError as e:
            print(f"[kiosco-apk] chequeo fallido: APK no encontrado {target}: {e}", file=sys.stderr, flush=True)
            self._error(404, "APK no disponible")
            return
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

    def _serve_tokens(self):
        """Sirve design tokens CSS (Fase 4) para admin/master/kiosco."""
        # Orden: master -> web-master/tokens.css, resto -> web/tokens.css, fallback -> kiosco/src/tokens.css
        candidates = []
        if self.MODE == "master":
            candidates.append(os.path.join(WEB_MASTER_DIR, "tokens.css"))
            candidates.append(os.path.join(WEB_DIR, "tokens.css"))
        else:
            candidates.append(os.path.join(WEB_DIR, "tokens.css"))
            candidates.append(os.path.join(WEB_MASTER_DIR, "tokens.css"))
        candidates.append(os.path.join(WEB_DIR, "kiosco", "src", "tokens.css"))
        target = next((p for p in candidates if os.path.isfile(p)), None)
        if not target:
            self._error(404, "tokens.css no encontrado")
            return
        with open(target, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", "text/css; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        # Tokens cambian poco; cache no-agresivo para reflejar bind mount al instante
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        self.wfile.write(body)

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
