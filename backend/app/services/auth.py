"""Auth service — sessions PG (Fase 2) con fallback dict para transición."""
import secrets
from datetime import timedelta
from db import db, release_conn, fetch_one, fetch_all

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
