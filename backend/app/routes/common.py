"""Common — ApiError + serialización movida desde server.py sin cambiar formato (Fase 3).

Contrato v2 manda: mismos status codes, mismos JSON, mismos mensajes.
Este módulo NO toca SQL/RLS/esquema; solo formatea filas ya leídas.
server.py conserva sus copias para infra/estáticos; aquí viven las copias
canónicas que usan los routers (responses idénticas byte a byte).
"""
import os
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from db import ROOM_TYPES, AMANECIDA_ENTRY, AMANECIDA_EXIT, HOLD_MINUTES, fetch_one
from db import exec as db_exec

ECUADOR_TZ = ZoneInfo("America/Guayaquil")

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

_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
STORAGE_DIR = os.path.abspath(os.path.join(_BASE_DIR, "..", "storage"))
ROOMS_PHOTO_DIR = os.path.join(STORAGE_DIR, "rooms")

PG_NOTIFY_CHANNEL = "cyhotel_changed"


class ApiError(Exception):
    """Error de API con status HTTP explícito. Handler lo convierte en {"error": msg}."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


class RouteCtx:
    """Contexto explícito de router: conn con RLS ya seteado + cola SSE.

    Los routers hacen pg_notify dentro de la txn vía emit() y encolan el
    broadcast SSE; el Handler hace sse_broadcast tras el commit (mismo orden
    que el Handler monolítico: broadcast antes de _send).
    """

    def __init__(self, conn, sess, hotel_id, data=None, qs=None, path="", mode="admin"):
        self.conn = conn
        self.sess = sess
        self.hotel_id = hotel_id
        self.data = data if isinstance(data, dict) else {}
        self.qs = qs if isinstance(qs, dict) else {}
        self.path = path
        self.mode = mode
        self.broadcasts = []

    def emit(self, event_type, data=None):
        payload = data or {}
        try:
            import json as _json

            db_exec(self.conn, "SELECT pg_notify(%s, %s)", (PG_NOTIFY_CHANNEL, _json.dumps({"type": event_type, "data": payload}, ensure_ascii=False)))
        except Exception:
            pass
        self.broadcasts.append((event_type, dict(payload)))

    def q(self, key, default=""):
        vals = self.qs.get(key) or [default]
        return vals[0] if vals else default


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
        raise ApiError(400, f"{name} debe tener formato YYYY-MM-DD")
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


def pg_notify(conn, event_type, data=None):
    import json as _json

    payload = _json.dumps({"type": event_type, "data": data or {}}, ensure_ascii=False)
    try:
        db_exec(conn, "SELECT pg_notify(%s, %s)", (PG_NOTIFY_CHANNEL, payload))
    except Exception:
        pass


def get_hotel_config(conn, hotel_id):
    row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (hotel_id,))
    return dict(row["config"] or {}) if row else {}


def _slug_for(conn, hotel_id):
    if not hotel_id:
        return None
    row = fetch_one(conn, "SELECT slug FROM hotels WHERE id = %s", (hotel_id,))
    return row["slug"] if row else None


def photo_url(conn, number, hotel_id):
    slug = _slug_for(conn, hotel_id) if hotel_id else None
    if slug and os.path.isfile(os.path.join(STORAGE_DIR, slug, "rooms", f"{number}.jpg")):
        return f"/uploads/{slug}/rooms/{number}.jpg"
    if os.path.isfile(os.path.join(ROOMS_PHOTO_DIR, f"{number}.jpg")):
        return f"/uploads/rooms/{number}.jpg"
    return None


def room_dict(conn, row, hotel_id):
    d = dict(row)
    info = ROOM_TYPES.get(d["type"]) or {}
    d["label"] = info.get("label", d["type"])
    d["photo"] = photo_url(conn, d["number"], hotel_id)
    return d


def order_items(row):
    from datetime import timedelta as _td  # noqa: F401 (compat, no uso)

    description = {
        "momento": f"Momento ({row['hours']}h)" if row.get("hours") else "Momento",
        "amanecida": "Amanecida",
        "hospedaje": f"Hospedaje ({row['hours'] // 24} día{'s' if row.get('hours') and row['hours'] > 24 else ''})" if row.get("hours") else "Hospedaje",
        "reserva": "Reserva",
    }.get(row.get("product"), row.get("product"))
    return [{"description": description, "amount": num(row.get("subtotal") or 0)}]


def order_payments(conn, order_id):
    from db import fetch_all as _fetch_all

    rows = _fetch_all(conn, "SELECT * FROM payments WHERE order_id = %s ORDER BY id DESC", (order_id,))
    result = []
    for r in rows:
        p = dict(r)
        p["amount"] = round(int(p["amount_cents"]) / 100, 2)
        for key in ("paid_at", "created_at"):
            if p.get(key) is not None:
                p[key] = local_str(p[key])
        result.append(p)
    return result


def order_dict(conn, row):
    from datetime import timedelta

    d = dict(row)
    d["subtotal"] = num(d.get("subtotal")) if d.get("subtotal") is not None else 0.0
    check_out_dt = row.get("check_out")
    d["remaining_seconds"] = max(0, int((check_out_dt - now()).total_seconds())) if check_out_dt else 0
    for key in ("check_in", "check_out", "created_at", "paid_at", "checked_out_at", "hold_expires_at", "updated_at"):
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
    d["items"] = order_items(row)
    return d


def sla_fields(conn, task):
    """SLA: base = started_at o created_at; vencida si base + sla_minutes < ahora (hotels.config, default 60)."""
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


def cleaning_dict(conn, row):
    d = dict(row)
    d["assigned_to"] = d.get("assigned_to")
    d.update(sla_fields(conn, d))
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


def incidence_dict(row):
    d = dict(row)
    d["room_label"] = ROOM_TYPES.get(d.get("room_type") or "", {}).get("label", d.get("room_type"))
    d["created_at_fmt"] = show_fmt(d.get("created_at"))
    d["resolved_at_fmt"] = show_fmt(d.get("resolved_at"))
    return d


def staff_dict(row):
    d = dict(row)
    d["active"] = bool(d["active"])
    if d.get("created_at") is not None:
        d["created_at"] = local_str(d["created_at"])
    return d
