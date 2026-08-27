"""Vencimientos multi-hotel (estadías, pendientes, por_asignar, holds); idempotente por SELECT FOR UPDATE antes de mutar."""

import os
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from db import db, release_conn, set_app_hotel, exec, fetch_one, fetch_all, HOLD_MINUTES

ECUADOR_TZ = ZoneInfo("America/Guayaquil")
WORKER_INTERVAL = int(os.environ.get("WORKER_INTERVAL", "35"))


def _now():
    return datetime.now(ECUADOR_TZ)


def _local(dt):
    if dt is None:
        return None
    return dt.astimezone(ECUADOR_TZ).strftime("%Y-%m-%d %H:%M")


def _audit(conn, hotel_id, action, order_id, room_id, staff, details):
    exec(
        conn,
        "INSERT INTO audit_log (hotel_id, action, order_id, room_id, staff_user, details) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (hotel_id, action, order_id, room_id, staff, details),
    )


def _room_history(conn, hotel_id, room_id, status):
    exec(
        conn,
        "INSERT INTO room_status_history (hotel_id, room_id, status) VALUES (%s, %s, %s)",
        (hotel_id, room_id, status),
    )


def _create_cleaning_task(conn, hotel_id, room_id, order_id, at):
    exec(
        conn,
        "INSERT INTO cleaning_tasks (hotel_id, room_id, order_id, status, created_at) "
        "VALUES (%s, %s, %s, 'pendiente', %s)",
        (hotel_id, room_id, order_id, at),
    )


def _free_room(conn, hotel_id, room_id):
    if not room_id:
        return
    exec(conn, "UPDATE rooms SET status = 'libre' WHERE id = %s AND status = 'ocupado'", (room_id,))
    _room_history(conn, hotel_id, room_id, "libre")


def _expire_paid(conn, hotel_id, now_dt):
    """Estadías pagadas/confirmadas vencidas -> finalizada + limpieza."""
    changed = 0
    candidates = fetch_all(
        conn,
        "SELECT id FROM orders WHERE hotel_id = %s AND status IN ('pagado', 'confirmada') AND check_out <= %s",
        (hotel_id, now_dt),
    )
    for c in candidates:
        row = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (c["id"],))
        if not row or row["status"] not in ("pagado", "confirmada") or row["check_out"] > now_dt:
            continue
        exec(
            conn,
            "UPDATE orders SET status = 'finalizada', checked_out_at = %s, updated_at = %s WHERE id = %s",
            (now_dt, now_dt, row["id"]),
        )
        if row["room_id"]:
            exec(
                conn,
                "UPDATE rooms SET status = 'en_limpieza' WHERE id = %s AND status = 'ocupado'",
                (row["room_id"],),
            )
            _room_history(conn, hotel_id, row["room_id"], "en_limpieza")
            _create_cleaning_task(conn, hotel_id, row["room_id"], row["id"], now_dt)
        _audit(
            conn, hotel_id, "liberacion_automatica", row["id"], row["room_id"], "sistema",
            f"Finalizada automáticamente al vencer el check_out ({_local(row['check_out'])})",
        )
        changed += 1
    return changed


def _expire_pending(conn, hotel_id, now_dt):
    """Órdenes pendientes (no reserva) con check_out vencido -> vencida + libre."""
    changed = 0
    candidates = fetch_all(
        conn,
        "SELECT id FROM orders WHERE hotel_id = %s AND status = 'pendiente' AND product != 'reserva' AND check_out <= %s",
        (hotel_id, now_dt),
    )
    for c in candidates:
        row = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (c["id"],))
        if not row or row["status"] != "pendiente" or row["product"] == "reserva" or row["check_out"] > now_dt:
            continue
        exec(conn, "UPDATE orders SET status = 'vencida', updated_at = %s WHERE id = %s", (now_dt, row["id"]))
        _free_room(conn, hotel_id, row["room_id"])
        _audit(
            conn, hotel_id, "orden_vencida", row["id"], row["room_id"], "sistema",
            f"Orden pendiente vencida (check_out {_local(row['check_out'])})",
        )
        changed += 1
    return changed


def _expire_unassigned(conn, hotel_id, now_dt, ttl_minutes):
    """Órdenes 'por_asignar' vencidas por assign_ttl_minutes o check_out."""
    changed = 0
    cutoff = now_dt - timedelta(minutes=ttl_minutes)
    candidates = fetch_all(
        conn,
        "SELECT id FROM orders WHERE hotel_id = %s AND status = 'por_asignar' AND (created_at <= %s OR check_out <= %s)",
        (hotel_id, cutoff, now_dt),
    )
    for c in candidates:
        row = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (c["id"],))
        if not row or row["status"] != "por_asignar":
            continue
        if row["created_at"] > cutoff and row["check_out"] > now_dt:
            continue
        exec(conn, "UPDATE orders SET status = 'vencida', updated_at = %s WHERE id = %s", (now_dt, row["id"]))
        _free_room(conn, hotel_id, row["room_id"])
        _audit(
            conn, hotel_id, "orden_vencida", row["id"], row["room_id"], "sistema",
            f"Orden sin asignar vencida (created_at {_local(row['created_at'])})",
        )
        changed += 1
    return changed


def _expire_holds(conn, hotel_id, now_dt):
    """Reservas pendientes con hold vencido -> vencida + libre."""
    changed = 0
    candidates = fetch_all(
        conn,
        "SELECT id FROM orders WHERE hotel_id = %s AND product = 'reserva' AND status = 'pendiente'",
        (hotel_id,),
    )
    for c in candidates:
        row = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (c["id"],))
        if not row or row["status"] != "pendiente":
            continue
        hold = row["hold_expires_at"] or (row["created_at"] + timedelta(minutes=HOLD_MINUTES))
        if hold > now_dt:
            continue
        exec(conn, "UPDATE orders SET status = 'vencida', updated_at = %s WHERE id = %s", (now_dt, row["id"]))
        _free_room(conn, hotel_id, row["room_id"])
        _audit(
            conn, hotel_id, "reserva_expirada", row["id"], row["room_id"], "sistema",
            f"Reserva pendiente expirada por hold de {HOLD_MINUTES} min",
        )
        changed += 1
    return changed


def _notify(conn, payload):
    try:
        exec(conn, "SELECT pg_notify(%s, %s)", ("cyhotel_changed", payload))
    except Exception:
        pass


def _tick_hotel(hotel_id, config):
    """Pasada de vencimientos de un solo hotel (transacción propia)."""
    config = config or {}
    try:
        ttl_minutes = int(config.get("assign_ttl_minutes") or 30)
    except (TypeError, ValueError):
        ttl_minutes = 30
    ttl_minutes = max(1, ttl_minutes)
    now_dt = _now()
    conn = db()
    set_app_hotel(conn, hotel_id)
    try:
        changed = 0
        changed += _expire_paid(conn, hotel_id, now_dt)
        changed += _expire_pending(conn, hotel_id, now_dt)
        changed += _expire_unassigned(conn, hotel_id, now_dt, ttl_minutes)
        changed += _expire_holds(conn, hotel_id, now_dt)
        if changed:
            import json
            _notify(
                conn,
                json.dumps(
                    {
                        "type": "data_changed",
                        "data": {"type": "jornada_finalizada", "hotel_id": hotel_id, "count": changed},
                    },
                    ensure_ascii=False,
                ),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        release_conn(conn)


def _worker_tick():
    conn = db()
    set_app_hotel(conn, "master")
    try:
        hotels = fetch_all(conn, "SELECT id, config FROM hotels WHERE activo ORDER BY id")
    finally:
        release_conn(conn)
    for h in hotels:
        try:
            _tick_hotel(h["id"], h.get("config") or {})
        except Exception as e:
            print(f"[worker] hotel {h['id']}: error: {e}", flush=True)


def worker_loop():
    while True:
        time.sleep(WORKER_INTERVAL)
        try:
            _worker_tick()
        except Exception as e:
            print(f"[worker] error: {e}", flush=True)


if __name__ == "__main__":
    worker_loop()
