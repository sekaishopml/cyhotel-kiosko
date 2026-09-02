"""Housekeeping service — extracción de server.py (Fase 3)."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from db import fetch_one, fetch_all
from db import exec as db_exec

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
    """Calcula SLA de limpieza desde hotels.config.cleaning_sla_minutes."""
    try:
        hid = task.get("hotel_id")
        if hid:
            row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (hid,))
            cfg = dict(row["config"] or {}) if row else {}
            sla = int(cfg.get("cleaning_sla_minutes") or 60)
        else:
            sla = 60
    except Exception:
        sla = 60
    created = task.get("created_at")
    if not created:
        return {"sla_minutes": sla, "overdue": False}
    elapsed = (_now() - created).total_seconds() / 60
    return {"sla_minutes": sla, "overdue": elapsed > sla and task.get("status") in ("pendiente", "en_proceso", "pausada")}

def cleaning_dict(conn, row):
    d = dict(row)
    d.update(_sla_fields(conn, d))
    for k in ("started_at", "completed_at", "created_at"):
        if d.get(k) is not None:
            d[k] = _local(d[k])
    return d

def get_tasks(conn, status=None, from_raw=None, to_raw=None):
    valid_status = ("pendiente", "en_proceso", "pausada", "completada", "incidencia")
    if status and status not in valid_status:
        raise ValueError("status inválido (pendiente, en_proceso, pausada, completada, incidencia)")
    where, params = [], []
    if status:
        where.append("ct.status = %s")
        params.append(status)
    if from_raw:
        # parse YYYY-MM-DD
        try:
            d = datetime.strptime(from_raw, "%Y-%m-%d").date()
        except Exception:
            raise ValueError("from debe tener formato YYYY-MM-DD")
        from_dt = datetime(d.year, d.month, d.day, tzinfo=ECUADOR_TZ)
        where.append("ct.created_at >= %s")
        params.append(from_dt)
    if to_raw:
        try:
            d = datetime.strptime(to_raw, "%Y-%m-%d").date()
        except Exception:
            raise ValueError("to debe tener formato YYYY-MM-DD")
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
    # incidencias abiertas
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
        # room label
        try:
            from db import ROOM_TYPES as RT
            d["room_label"] = RT.get(r["room_type"], {}).get("label", r["room_type"])
        except Exception:
            d["room_label"] = r["room_type"]
        inc = open_incs.get(r["id"])
        d["has_incidence_open"] = bool(inc)
        d["paused_at"] = _local(inc["created_at"]) if inc else None
        for key in ("started_at", "completed_at", "created_at"):
            if d.get(key) is not None:
                d[key] = _local(d[key])
        result.append(d)
    return result
