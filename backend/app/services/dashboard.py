"""Dashboard service — lógica movida desde server.py sin cambiar SQL ni formato (Fase 3).

Funciones puras sobre conn con RLS ya seteado. Retornan dict payload listo
para (200, payload). Formato vía app.routes.common (copia exacta server.py).
"""
from datetime import datetime, timedelta

from db import ROOM_TYPES, fetch_one, fetch_all
from app.routes.common import (
    ApiError,
    now,
    local_str,
    show_fmt,
    num,
    parse_date_local,
    order_dict,
    room_dict,
    sla_fields,
    PRODUCT_LABELS,
    ACTIVITY_LABELS,
    ECUADOR_TZ,
)


def overview(conn, hotel_id):
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
    sla_row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (hotel_id,))
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
        d = order_dict(conn, row)
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
        d = order_dict(conn, r)
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
        d = order_dict(conn, r)
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
        """,
    )
    attention_cleaning = []
    for r in clean_rows:
        d = dict(r)
        d["task_status"] = d["status"]
        d["assigned_to"] = r["assigned_to"]
        d["has_incidence_open"] = bool(d["has_incidence_open"])
        d["room_label"] = ROOM_TYPES.get(d["room_type"], {}).get("label", d["room_type"])
        d.update(sla_fields(conn, d))
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
    attention_blocked = [room_dict(conn, r, hotel_id) for r in blocked_rows]

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

    return {
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
    }


def occupancy(conn, hotel_id):
    result = []
    for key, info in ROOM_TYPES.items():
        rows = fetch_all(conn, "SELECT * FROM rooms WHERE type = %s ORDER BY id", (key,))
        rooms = [room_dict(conn, r, hotel_id) for r in rows]
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
    return {"as_of": now().isoformat(), "types": result, "totals": totals}


def alerts(conn, hotel_id):
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
    sla_row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (hotel_id,))
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
    return {
        "to_assign": to_assign,
        "pending_payments": pending_payments,
        "departures_overdue": departures_overdue,
        "cleaning": cleaning,
        "cleaning_overdue": cleaning_overdue,
    }


def close_report(conn, hotel_id, date_raw=""):
    if date_raw:
        day_start = parse_date_local(date_raw, "date")
    else:
        now_dt = now()
        day_start = datetime(now_dt.year, now_dt.month, now_dt.day, tzinfo=ECUADOR_TZ)
    day_end = day_start + timedelta(days=1)
    date_str = day_start.strftime("%Y-%m-%d")
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
    return {
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
    }


def daily_report(conn, hotel_id, date_raw=""):
    if date_raw:
        day_start = parse_date_local(date_raw, "date")
    else:
        now_dt = now()
        day_start = datetime(now_dt.year, now_dt.month, now_dt.day, tzinfo=ECUADOR_TZ)
    day_end = day_start + timedelta(days=1)
    date_str = day_start.strftime("%Y-%m-%d")
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
    sla_row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (hotel_id,))
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
    return {
        "date": date_str,
        "por_producto": list(por_producto.values()),
        "por_metodo": list(por_metodo.values()),
        "por_tipo_habitacion": por_tipo_habitacion,
        "ocupacion_pico": ocupacion_pico,
        "anuladas": anuladas,
        "limpieza": limpieza,
    }
