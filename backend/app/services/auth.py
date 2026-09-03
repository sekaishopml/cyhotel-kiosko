"""Auth service — sessions PG (Fase 2) con login (Fase 3). Import duro: falla en boot si DB no disponible."""
import os
import secrets
from datetime import timedelta
from db import db, release_conn, fetch_one, fetch_all, verify_password
from app.routes.common import ApiError

# Compat: dict en memoria para transición; se vaciará cuando PG sea fuente única
_sessions_mem = {}

TOKEN_TTL = timedelta(hours=12)

def _now():
    from datetime import datetime
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("America/Guayaquil"))

def create_session(conn, username, role, hotel_id, scope):
    """Crea sesión en PG y en memoria; retorna token."""
    token = secrets.token_hex(32)
    expires = _now() + TOKEN_TTL
    # PG
    try:
        conn2 = db()
        try:
            # no RLS para sessions
            with conn2.cursor() as cur:
                cur.execute(
                    "INSERT INTO sessions (token, hotel_id, username, role, scope, expires) VALUES (%s,%s,%s,%s,%s,%s)",
                    (token, hotel_id, username, role, scope, expires),
                )
            conn2.commit()
        finally:
            release_conn(conn2)
    except Exception:
        try:
            conn2.rollback()
        except Exception:
            pass
        try:
            release_conn(conn2)
        except Exception:
            pass
    # mem compat
    _sessions_mem[token] = {"username": username, "role": role, "hotel_id": hotel_id, "scope": scope, "expires": expires}
    return token, expires

def get_session(token):
    """Lee de PG primero, fallback mem, verifica expiración."""
    if not token:
        return None
    # PG
    try:
        conn = db()
        try:
            row = fetch_one(conn, "SELECT token, hotel_id, username, role, scope, expires FROM sessions WHERE token=%s", (token,))
            if row:
                # row expires is datetime
                from zoneinfo import ZoneInfo
                from datetime import datetime
                exp = row["expires"]
                # ensure aware
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=ZoneInfo("America/Guayaquil"))
                if exp < _now():
                    # expirado → borrar
                    with conn.cursor() as cur:
                        cur.execute("DELETE FROM sessions WHERE token=%s", (token,))
                    conn.commit()
                    _sessions_mem.pop(token, None)
                    return None
                sess = {"username": row["username"], "role": row["role"], "hotel_id": row["hotel_id"], "scope": row["scope"], "expires": exp}
                # sync mem
                _sessions_mem[token] = sess
                return sess
        finally:
            release_conn(conn)
    except Exception:
        pass
    # fallback mem
    sess = _sessions_mem.get(token)
    if not sess:
        return None
    if sess["expires"] < _now():
        _sessions_mem.pop(token, None)
        # intenta borrar PG también
        try:
            conn = db()
            try:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM sessions WHERE token=%s", (token,))
                conn.commit()
            finally:
                release_conn(conn)
        except Exception:
            pass
        return None
    return sess

def delete_session(token):
    _sessions_mem.pop(token, None)
    try:
        conn = db()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE token=%s", (token,))
            conn.commit()
        finally:
            release_conn(conn)
    except Exception:
        pass

def cleanup_expired():
    """Borra sesiones expiradas (llamar desde worker)."""
    try:
        conn = db()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE expires < NOW()")
            conn.commit()
            # limpia mem
            now = _now()
            for k, v in list(_sessions_mem.items()):
                if v["expires"] < now:
                    _sessions_mem.pop(k, None)
        finally:
            release_conn(conn)
    except Exception:
        pass

# Expose mem for compat durante transición
sessions = _sessions_mem


def get_login_user(conn, username, hotel_id, is_master):
    """Busca usuario para login. Master: hotel_id IS NULL + role master; hotel: hotel_id fijo."""
    if is_master:
        return fetch_one(
            conn,
            "SELECT * FROM users WHERE hotel_id IS NULL AND username = %s AND role = 'master'",
            (username,),
        )
    return fetch_one(
        conn, "SELECT * FROM users WHERE hotel_id = %s AND username = %s",
        (hotel_id, username),
    )


def login_with_password(conn, username, password, hotel_id, is_master):
    """Valida credenciales y crea sesión. Retorna (token, username, role, scope).

    Lanza ApiError(401, "Usuario o contraseña incorrectos") si falla.
    No hace commit/audit: el router audita y commitea en la misma txn del login.
    """
    username = (username or "").strip()
    password = password or ""
    user = get_login_user(conn, username, hotel_id, is_master)
    if not user or not verify_password(password, username, user["password_hash"]):
        raise ApiError(401, "Usuario o contraseña incorrectos")
    scope = "master" if is_master else "hotel"
    scope_hotel = None if is_master else hotel_id
    token, _ = create_session(None, user["username"], user["role"], scope_hotel, scope)
    return token, user["username"], user["role"], scope, user


def login_with_pin(pin, hotel_id):
    """Valida PIN de emergencia (env CYHOTEL_ADMIN_PIN) y crea sesión gerencia.

    Lanza ApiError(401, "PIN incorrecto") si falla. Retorna (token, username, role, scope).
    """
    pin = (pin or "").strip()
    admin_pin = os.environ.get("CYHOTEL_ADMIN_PIN", "12345")
    if pin != admin_pin:
        raise ApiError(401, "PIN incorrecto")
    token, _ = create_session(None, "admin", "gerencia", hotel_id, "hotel")
    return token, "admin", "gerencia", "hotel"
