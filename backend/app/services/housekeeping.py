"""Housekeeping service — extracción de server.py (Fase 3, contrato v2 manda).

SLA y serialización idénticos a server.py:_sla_fields/_cleaning_dict.
Mutaciones con mismo SQL/mensajes que server.py. No commitean: el router
audita, emite y commitea. Lanzan ApiError(400/404).
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from db import ROOM_TYPES, fetch_one, fetch_all
from db import exec as db_exec
from app.routes.common import ApiError

ECUADOR_TZ = ZoneInfo("America/Guayaquil")


def _now():
    return datetime.now(ECUADOR_TZ)


def _local(dt):
    if dt is None:
        return None
    return dt.astimezone(ECUADOR_TZ).strftime("%Y-%m-%d %H:%M")


def _num(v):
    from decimal import Decimal
    if isinstance(v, Decimal):
        return float(v)
    return v


def _sla_fields(conn, task):
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
    overdue_minutes = int((_now() - base).total_seconds() // 60) - sla
    return {
        "sla_minutes": sla,
        "sla_overdue": overdue_minutes > 0,
        "sla_overdue_minutes": max(0, overdue_minutes),
    }


def cleaning_dict(conn, row):
    d = dict(row)
    d["assigned_to"] = d.get("assigned_to")
    d.update(_sla_fields(conn, d))
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
    d["paused_at"] = _local(open_inc["created_at"]) if open_inc else None
    for key in ("started_at", "completed_at", "created_at"):
        if d.get(key) is not None:
            d[key] = _local(d[key])
    return d


def get_cleaning_task(conn, task_id):
    return fetch_one(conn, "SELECT * FROM cleaning_tasks WHERE id = %s", (task_id,))


def get_tasks(conn, status=None, from_raw=None, to_raw=None):
    valid_status = ("pendiente", "en_proceso", "pausada", "completada", "incidencia")
    if status and status not in valid_status:
        raise ApiError(400, "status inválido (pendiente, en_proceso, pausada, completada, incidencia)")
    where, params = [], []
    if status:
        where.append("ct.status = %s")
        params.append(status)
    if from_raw:
        try:
            d = datetime.strptime(from_raw, "%Y-%m-%d").date()
        except Exception:
            raise ApiError(400, "from debe tener formato YYYY-MM-DD")
        from_dt = datetime(d.year, d.month, d.day, tzinfo=ECUADOR_TZ)
        where.append("ct.created_at >= %s")
        params.append(from_dt)
    if to_raw:
        try:
            d = datetime.strptime(to_raw, "%Y-%m-%d").date()
        except Exception:
            raise ApiError(400, "to debe tener formato YYYY-MM-DD")
        to_dt = datetime(d.year, d.month, d.day, tzinfo=ECUADOR_TZ) + timedelta(days=1)
        where.append("ct.created_at < %s")
        params.append(to_dt)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
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
            "SELECT id, task_id, created_at FROM incidences WHERE task_id = ANY(%s) AND status = 'abierta'",
            (ids,),
        ):
            open_incs.setdefault(inc["task_id"], inc)
    result = []
    for r in rows:
        d = dict(r)
        d["assigned_to"] = r["assigned_to"]
        d.update(_sla_fields(conn, d))
        d["room_label"] = ROOM_TYPES.get(r["room_type"], {}).get("label", r["room_type"])
        inc = open_incs.get(r["id"])
        d["has_incidence_open"] = bool(inc)
        d["paused_at"] = _local(inc["created_at"]) if inc else None
        for key in ("started_at", "completed_at", "created_at"):
            if d.get(key) is not None:
                d[key] = _local(d[key])
        result.append(d)
    return result


def start_task(conn, task_id):
    """Pasa pendiente/pausada/incidencia -> en_proceso (started_at solo desde pendiente).

    Copia server.py:housekeeping_start. Retorna task row fresca. Lanza ApiError.
    """
    try:
        task_id = int(task_id)
    except (TypeError, ValueError):
        raise ApiError(400, "id de tarea inválido")
    task = get_cleaning_task(conn, task_id)
    if not task:
        raise ApiError(404, "Tarea de limpieza no encontrada")
    if task["status"] == "completada":
        raise ApiError(400, "La tarea ya está completada")
    if task["status"] != "en_proceso":
        if task["status"] == "pendiente":
            db_exec(
                conn,
                "UPDATE cleaning_tasks SET status = 'en_proceso', started_at = %s WHERE id = %s",
                (_now(), task_id),
            )
        else:
            db_exec(
                conn,
                "UPDATE cleaning_tasks SET status = 'en_proceso' WHERE id = %s",
                (task_id,),
            )
    return get_cleaning_task(conn, task_id)


def complete_task(conn, task_id, username):
    """Completa tarea (no pendiente), resuelve incidencia abierta y libera cuarto.

    Copia server.py:housekeeping_complete. Retorna task row fresca. Lanza ApiError.
    """
    try:
        task_id = int(task_id)
    except (TypeError, ValueError):
        raise ApiError(400, "id de tarea inválido")
    task = get_cleaning_task(conn, task_id)
    if not task:
        raise ApiError(404, "Tarea de limpieza no encontrada")
    if task["status"] == "completada":
        raise ApiError(400, "La tarea ya está completada")
    if task["status"] == "pendiente":
        raise ApiError(400, "La tarea debe iniciarse antes")
    db_exec(
        conn,
        "UPDATE cleaning_tasks SET status = 'completada', completed_at = %s WHERE id = %s",
        (_now(), task_id),
    )
    open_inc = fetch_one(
        conn,
        "SELECT id FROM incidences WHERE task_id = %s AND status = 'abierta' ORDER BY id DESC LIMIT 1",
        (task_id,),
    )
    if open_inc:
        db_exec(
            conn,
            "UPDATE incidences SET status = 'resuelta', resolved_by = %s, resolved_at = %s WHERE id = %s",
            (username, _now(), open_inc["id"]),
        )
    room = fetch_one(conn, "SELECT * FROM rooms WHERE id = %s", (task["room_id"],))
    if room and room["status"] == "en_limpieza":
        db_exec(conn, "UPDATE rooms SET status = 'libre' WHERE id = %s AND status = 'en_limpieza'", (task["room_id"],))
        db_exec(
            conn,
            "INSERT INTO room_status_history (hotel_id, room_id, status) "
            "VALUES ((SELECT current_hotel_id()), %s, %s)",
            (task["room_id"], "libre"),
        )
    return get_cleaning_task(conn, task_id), (open_inc["id"] if open_inc else None)


def report_incident(conn, hotel_id, task_id, notes, username):
    """Crea incidencia abierta y pausa la tarea. Copia server.py:housekeeping_incident."""
    notes = (notes or "").strip()
    if not notes:
        raise ApiError(400, "notes es obligatorio para reportar una incidencia")
    try:
        task_id = int(task_id)
    except (TypeError, ValueError):
        raise ApiError(400, "id de tarea inválido")
    task = get_cleaning_task(conn, task_id)
    if not task:
        raise ApiError(404, "Tarea de limpieza no encontrada")
    if task["status"] == "completada":
        raise ApiError(400, "La tarea ya está completada")
    open_inc = fetch_one(
        conn,
        "SELECT id FROM incidences WHERE task_id = %s AND status = 'abierta' ORDER BY id DESC LIMIT 1",
        (task_id,),
    )
    if open_inc:
        raise ApiError(400, "Ya existe una incidencia abierta para esta tarea")
    inc_row = fetch_one(
        conn,
        "INSERT INTO incidences (hotel_id, task_id, room_id, notes, status, created_by) "
        "VALUES (%s, %s, %s, %s, 'abierta', %s) RETURNING *",
        (hotel_id, task_id, task["room_id"], notes, username),
    )
    db_exec(
        conn,
        "UPDATE cleaning_tasks SET status = 'pausada', notes = %s WHERE id = %s",
        (notes, task_id),
    )
    return get_cleaning_task(conn, task_id), inc_row
