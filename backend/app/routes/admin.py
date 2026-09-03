"""Admin routes — HOTEL_ID por sesión, handlers con ctx explícito (Fase 3).

Cada función recibe RouteCtx (conn con RLS, sess, hotel_id, data, qs, path)
y retorna (status_code, payload) o lanza ApiError. SQL/JSON/mensajes idénticos
a server.py (contrato v2). Lógica de negocio en services/ donde existe.
"""
import json
import math
import os
from datetime import datetime, timedelta

from db import (
    ROOM_TYPES, AMANECIDA_ENTRY, AMANECIDA_EXIT, HOLD_MINUTES,
    fetch_one, fetch_all, verify_password,
)
from db import exec as db_exec
from app.routes.common import (
    ApiError, RouteCtx, now, local_str, show_fmt, num, parse_date_local,
    audit, room_history, order_dict, order_payments, room_dict,
    cleaning_dict, incidence_dict, staff_dict, sla_fields,
    get_hotel_config, ORDER_STATUSES, ORDER_PRODUCTS,
    CLEANING_STATUSES, INCIDENCE_STATUSES, PRODUCT_LABELS, EXTEND_OPTIONS,
    ECUADOR_TZ,
)
from app.services import auth as auth_svc
from app.services import rooms as rooms_svc
from app.services import housekeeping as hk_svc
from app.services import dashboard as dash_svc
from app.services import validation as validation_svc
from app.services import orders as orders_svc


def admin_routes():
    return [
        "GET /api/rooms",
        "GET /api/rooms/available",
        "POST /api/rooms/:id/status",
        "GET /api/orders",
        "GET /api/orders/:id",
        "POST /api/orders/:id/assign",
        "POST /api/orders/:id/pay",
        "POST /api/orders/:id/cancel",
        "POST /api/orders/:id/checkout",
        "POST /api/orders/:id/extend",
        "GET /api/reservations",
        "GET /api/housekeeping/tasks",
        "GET /api/housekeeping/staff",
        "POST /api/housekeeping/staff",
        "POST /api/housekeeping/staff/:id/deactivate",
        "POST /api/housekeeping/tasks/:id/start|complete|incident|assign-staff",
        "GET /api/incidences",
        "POST /api/incidences/:id/resolve",
        "GET /api/dashboard/*",
        "GET /api/audit",
        "GET /api/hotel/settings",
        "POST /api/hotel/settings",
        "GET /api/events?token=",
    ]


# ---------------------------------------------------------------- auth ---

def login(ctx: RouteCtx):
    conn, data = ctx.conn, ctx.data
    is_master = (ctx.mode == "master")
    hotel_id = None if is_master else ctx.hotel_id
    username = ((data.get("username") or "").strip())
    try:
        token, uname, role, scope, _user = auth_svc.login_with_password(
            conn, username, data.get("password") or "", hotel_id, is_master)
    except ApiError:
        try:
            audit(conn, hotel_id, "login_fail", None, None, username or "anónimo",
                  "Intento de login fallido")
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    try:
        audit(conn, hotel_id, "login_ok", None, None, uname, f"Login exitoso como {role}")
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    return 200, {"token": token, "username": uname, "role": role, "scope": scope}


def pin_login(ctx: RouteCtx):
    token, uname, role, scope = auth_svc.login_with_pin(
        (ctx.data.get("pin") or ""), ctx.hotel_id)
    return 200, {"token": token, "username": uname, "role": role, "scope": scope}


def logout(ctx: RouteCtx):
    conn, sess = ctx.conn, ctx.sess or {}
    token = getattr(ctx, "token", "") or ""
    username = sess.get("username") if sess else "anónimo"
    hotel_id = ctx.hotel_id
    try:
        audit(conn, hotel_id, "logout", None, None, username, "Cierre de sesión")
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
    auth_svc.delete_session(token)
    return 200, {"ok": True, "message": "Sesión cerrada"}


def me(ctx: RouteCtx):
    sess = ctx.sess or {}
    return 200, {
        "username": sess.get("username"),
        "role": sess.get("role"),
        "scope": sess.get("scope", "hotel"),
    }


# --------------------------------------------------------------- rooms ---

def list_rooms(ctx: RouteCtx):
    rooms = rooms_svc.list_rooms(ctx.conn, ctx.hotel_id)
    return 200, {"rooms": rooms}


def list_rooms_available(ctx: RouteCtx):
    rooms = rooms_svc.list_available(ctx.conn, ctx.hotel_id)
    return 200, {"rooms": rooms}


def set_room_status(ctx: RouteCtx):
    conn, sess, hotel_id, data = ctx.conn, ctx.sess or {}, ctx.hotel_id, ctx.data
    room_id = int(ctx.path.split("/")[-2])
    status = (data.get("status") or "").strip()
    reason = data.get("reason")
    try:
        room, task_row = rooms_svc.set_room_status(conn, hotel_id, room_id, status, reason, sess.get("username"))
        created_task = cleaning_dict(conn, task_row) if task_row else None
        # reason normalizado como server.py ("" si no bloqueado)
        _r = reason.strip() if isinstance(reason, str) else ""
        if status != "bloqueado":
            _r = ""
        details = f"{room['number']}: {room['status']} -> {status}"
        if _r:
            details += f" · motivo: {_r}"
        audit(conn, hotel_id, "cambiar_estado_cuarto", None, room_id, sess.get("username"), details)
        ctx.emit("data_changed", {"type": "estado_cuarto", "room_id": room_id, "status": status})
        conn.commit()
        fresh = fetch_one(conn, "SELECT * FROM rooms WHERE id = %s", (room_id,))
        result = {"room": room_dict(conn, fresh, hotel_id), "task": created_task, "reason": _r or None}
        return 200, result
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


# -------------------------------------------------------------- orders ---

def list_orders(ctx: RouteCtx):
    conn = ctx.conn
    status = ctx.q("status", "").strip()
    product = ctx.q("product", "").strip()
    search = ctx.q("search", "").strip()
    from_raw = ctx.q("from", "").strip()
    to_raw = ctx.q("to", "").strip()
    try:
        limit = int(ctx.q("limit", "50"))
        page = int(ctx.q("page", "1"))
    except ValueError:
        raise ApiError(400, "limit y page deben ser enteros")
    limit = max(1, min(limit, 200))
    page = max(1, page)
    if status and status not in ORDER_STATUSES:
        raise ApiError(400, "status inválido")
    if product and product not in ORDER_PRODUCTS:
        raise ApiError(400, "product inválido")

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
    result = [order_dict(conn, r) for r in rows]
    return 200, {"orders": result, "total": total, "page": page, "pages": pages}


def get_order_detail(ctx: RouteCtx):
    conn = ctx.conn
    try:
        order_id = int(ctx.path[len("/api/orders/"):].rstrip("/"))
    except ValueError:
        raise ApiError(400, "id de orden inválido")
    order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
    if not order:
        raise ApiError(404, "Orden no encontrada")
    detail = order_dict(conn, order)
    detail["payments_history"] = order_payments(conn, order_id)
    return 200, {"order": detail}


def list_reservations(ctx: RouteCtx):
    conn = ctx.conn
    status = ctx.q("status", "").strip()
    if status and status not in ("pendiente", "confirmada", "vencida", "anulado"):
        raise ApiError(400, "status inválido (pendiente, confirmada, vencida, anulado)")
    try:
        limit = int(ctx.q("limit", "100"))
    except ValueError:
        raise ApiError(400, "limit debe ser un entero")
    limit = max(1, min(limit, 100))
    where, params = ["o.product = 'reserva'"], []
    if status:
        where.append("o.status = %s")
        params.append(status)
    rows = fetch_all(
        conn,
        f"SELECT o.*, r.number AS room_number FROM orders o LEFT JOIN rooms r ON r.id = o.room_id WHERE {' AND '.join(where)} ORDER BY o.id DESC LIMIT %s",
        params + [limit],
    )
    result = [order_dict(conn, r) for r in rows]
    return 200, {"reservations": result}


def assign_order(ctx: RouteCtx):
    conn, sess, hotel_id, data = ctx.conn, ctx.sess or {}, ctx.hotel_id, ctx.data
    order_id = int(ctx.path.split("/")[-2])
    requested_room = None
    if data is not None and data.get("room_id") is not None:
        try:
            requested_room = int(data.get("room_id"))
        except (TypeError, ValueError):
            raise ApiError(400, "room_id debe ser un entero")
    try:
        order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (order_id,))
        if not order:
            raise ApiError(404, "Orden no encontrada")
        if order["status"] != "por_asignar":
            raise ApiError(400, f"La orden no está pendiente de asignación (estado: {order['status']})")
        if not order["room_type"]:
            raise ApiError(400, "La orden no tiene tipo de habitación definido")
        if requested_room:
            room = fetch_one(
                conn,
                "SELECT * FROM rooms WHERE id = %s AND status = 'libre' FOR UPDATE",
                (requested_room,),
            )
            if not room:
                raise ApiError(400, "La habitación seleccionada no está libre")
            if room["type"] != order["room_type"]:
                raise ApiError(
                    400,
                    f"La habitación {room['number']} es '{room['type']}', pero la orden requiere '{order['room_type']}'",
                )
            db_exec(conn, "UPDATE rooms SET status = 'ocupado' WHERE id = %s", (room["id"],))
            room_history(conn, room["id"], "ocupado")
        else:
            room = orders_svc.assign_room_candidate(conn, order["room_type"])
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
        audit(conn, hotel_id, "asignar_habitacion", order_id, room["id"], sess.get("username"),
              f"Orden {order_id} -> hab. {room['number']} ({room['type']})")
        ctx.emit("data_changed", {"type": "orden_asignada", "order_id": order_id, "room_id": room["id"]})
        conn.commit()
        fresh = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
        result = order_dict(conn, fresh)
        return 200, {"order": result}
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


def pay_order(ctx: RouteCtx):
    conn, sess, hotel_id, data = ctx.conn, ctx.sess or {}, ctx.hotel_id, ctx.data
    order_id = int(ctx.path.split("/")[-2])
    method = (data.get("payment_method") or "").strip()
    if method not in ("efectivo", "transferencia"):
        raise ApiError(400, "payment_method es obligatorio y debe ser: efectivo o transferencia")
    reference = (data.get("payment_reference") or "").strip() or None
    if method == "transferencia" and not reference:
        raise ApiError(400, "payment_reference es obligatorio para transferencia")
    idempotency_key = (data.get("idempotency_key") or "").strip() or None
    try:
        order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (order_id,))
        if not order:
            raise ApiError(404, "Orden no encontrada")

        cfg = get_hotel_config(conn, hotel_id)
        subtotal = order["subtotal"]
        if order["product"] == "reserva" and order["subtotal"] == 0:
            amount = data.get("amount")
            if amount is None or amount == "":
                try:
                    tarifa = float(cfg.get("reserva_tarifa") or 0)
                except (TypeError, ValueError):
                    tarifa = 0.0
                if tarifa <= 0:
                    raise ApiError(400, "monto es obligatorio para reservas sin tarifa definida")
                subtotal = round(tarifa, 2)
            else:
                try:
                    subtotal = round(float(amount), 2)
                except (TypeError, ValueError):
                    raise ApiError(400, "monto debe ser un número")
                if subtotal <= 0:
                    raise ApiError(400, "monto debe ser mayor a 0")
        subtotal = float(subtotal)
        amount_cents = round(subtotal * 100)

        duplicate = None
        if idempotency_key:
            duplicate = fetch_one(
                conn, "SELECT * FROM payments WHERE idempotency_key = %s", (idempotency_key,)
            )
        else:
            since = now() - timedelta(seconds=5)
            duplicate = fetch_one(
                conn,
                "SELECT * FROM payments WHERE order_id = %s AND amount_cents = %s AND method = %s "
                "AND paid_at >= %s ORDER BY id DESC LIMIT 1",
                (order_id, amount_cents, method, since),
            )
        if duplicate:
            conn.commit()
            return 200, {
                "order": order_dict(conn, order),
                "duplicate": True,
                "message": "Pago duplicado: se devuelve el registro existente",
            }

        if order["status"] == "anulado":
            raise ApiError(400, "No se puede pagar una orden anulada")
        if order["status"] in ("pagado", "confirmada"):
            raise ApiError(400, "La orden ya está pagada")
        if order["status"] in ("finalizada", "vencida"):
            raise ApiError(400, "No se puede pagar una orden finalizada o vencida")

        if order["product"] == "reserva":
            hold = order["hold_expires_at"] or (order["created_at"] + timedelta(minutes=HOLD_MINUTES))
            if hold and hold < now():
                raise ApiError(400, "El hold de la reserva expiró; la habitación ya no está retenida")

        paid_at = now()
        new_status = "confirmada" if order["product"] == "reserva" else "pagado"
        inserted = db_exec(
            conn,
            "INSERT INTO payments (hotel_id, order_id, amount_cents, currency, method, reference, "
            "paid_at, recorded_by, idempotency_key) "
            "VALUES (%s, %s, %s, 'USD', %s, %s, %s, %s, %s) "
            "ON CONFLICT (hotel_id, idempotency_key) DO NOTHING RETURNING id",
            (hotel_id, order_id, amount_cents, method, reference, paid_at, sess.get("username"), idempotency_key),
        )
        if not inserted:
            conn.commit()
            return 200, {
                "order": order_dict(conn, order),
                "duplicate": True,
                "message": "Pago duplicado: se devuelve el registro existente",
            }
        db_exec(
            conn,
            "UPDATE orders SET status = %s, payment_method = %s, payment_reference = %s, "
            "subtotal = %s, paid_at = %s, paid_by = %s, updated_at = %s WHERE id = %s",
            (new_status, method, reference, subtotal, paid_at, sess.get("username"), paid_at, order_id),
        )
        details = f"Pago {method} confirmado: ${subtotal:.2f}"
        if reference:
            details += f" (ref {reference})"
        audit(conn, hotel_id, "confirmar_pago", order_id, order["room_id"], sess.get("username"), details)
        ctx.emit("data_changed", {"type": "pago_confirmado", "order_id": order_id})
        conn.commit()
        fresh = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
        result = order_dict(conn, fresh)
        return 200, {"order": result}
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


def cancel_order(ctx: RouteCtx):
    conn, sess, hotel_id, data = ctx.conn, ctx.sess or {}, ctx.hotel_id, ctx.data
    order_id = int(ctx.path.split("/")[-2])
    reason = (data.get("reason") or "sin motivo").strip()
    try:
        order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (order_id,))
        if not order:
            raise ApiError(404, "Orden no encontrada")
        if order["status"] == "anulado":
            raise ApiError(400, "La orden ya está anulada")
        if order["status"] in ("pagado", "confirmada"):
            raise ApiError(400, "La orden ya está pagada; no puede anularse")
        if order["status"] in ("finalizada", "vencida"):
            raise ApiError(400, "La orden ya está finalizada o vencida; no puede anularse")
        db_exec(conn, "UPDATE orders SET status = 'anulado', updated_at = %s WHERE id = %s", (now(), order_id))
        if order["room_id"]:
            db_exec(conn, "UPDATE rooms SET status = 'libre' WHERE id = %s AND status = 'ocupado'", (order["room_id"],))
            room_history(conn, order["room_id"], "libre")
        audit(conn, hotel_id, "anular_orden", order_id, order["room_id"], sess.get("username"), reason)
        ctx.emit("data_changed", {"type": "orden_anulada", "order_id": order_id})
        conn.commit()
        fresh = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
        result = order_dict(conn, fresh)
        return 200, {"order": result}
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


def checkout_order(ctx: RouteCtx):
    conn, sess, hotel_id = ctx.conn, ctx.sess or {}, ctx.hotel_id
    order_id = int(ctx.path.split("/")[-2])
    try:
        order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (order_id,))
        if not order:
            raise ApiError(404, "Orden no encontrada")
        if order["status"] in ("finalizada", "vencida", "anulado"):
            raise ApiError(400, "La orden ya está finalizada, vencida o anulada")
        if order["status"] not in ("pagado", "confirmada"):
            raise ApiError(400, "Solo se puede hacer checkout de una orden pagada o confirmada")
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
        audit(conn, hotel_id, "checkout", order_id, order["room_id"], sess.get("username"),
              f"Checkout a las {local_str(now_dt)}")
        ctx.emit("data_changed", {"type": "checkout", "order_id": order_id})
        conn.commit()
        fresh = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
        result = order_dict(conn, fresh)
        return 200, {"order": result}
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


def extend_order(ctx: RouteCtx):
    conn, sess, hotel_id, data = ctx.conn, ctx.sess or {}, ctx.hotel_id, ctx.data
    order_id = int(ctx.path.split("/")[-2])
    extra = (data.get("extra") or "").strip()
    if extra not in EXTEND_OPTIONS:
        raise ApiError(400, "extra debe ser '1h' o '6h'")
    hours, price = EXTEND_OPTIONS[extra]
    method = (data.get("payment_method") or "").strip()
    if method not in ("efectivo", "transferencia"):
        raise ApiError(400, "payment_method es obligatorio y debe ser: efectivo o transferencia")
    reference = (data.get("payment_reference") or "").strip() or None
    if method == "transferencia" and not reference:
        raise ApiError(400, "payment_reference es obligatorio para transferencia")
    idempotency_key = (data.get("idempotency_key") or "").strip() or None
    try:
        order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s FOR UPDATE", (order_id,))
        if not order:
            raise ApiError(404, "Orden no encontrada")
        if idempotency_key:
            dup = fetch_one(conn, "SELECT id FROM payments WHERE idempotency_key = %s", (idempotency_key,))
            if dup:
                conn.commit()
                return 200, {
                    "order": order_dict(conn, order),
                    "duplicate": True,
                    "message": "Extensión duplicada: se devuelve el estado existente",
                }
        if order["status"] not in ("pagado", "confirmada"):
            raise ApiError(
                400,
                f"Extensión solo permitida en órdenes pagadas o confirmadas (estado: {order['status']})",
            )
        info = ROOM_TYPES.get(order["room_type"]) or {}
        if extra not in info.get("extras") or {}:
            raise ApiError(
                400,
                f"El tipo de habitación '{order['room_type']}' no ofrece extensión de {extra}",
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
            (hotel_id, order_id, amount_cents, method, reference, now(), sess.get("username"), idempotency_key),
        )
        if not inserted:
            conn.commit()
            return 200, {
                "order": order_dict(conn, order),
                "duplicate": True,
                "message": "Extensión duplicada: se devuelve el estado existente",
            }
        db_exec(
            conn,
            "UPDATE orders SET check_out = %s, subtotal = %s, updated_at = %s WHERE id = %s",
            (new_check_out, round(new_subtotal, 2), now(), order_id),
        )
        audit(conn, hotel_id, "extender_estadia", order_id, order["room_id"], sess.get("username"),
              f"Extensión +{hours}h (${price:.2f} {method})")
        ctx.emit("data_changed", {"type": "orden_extendida", "order_id": order_id, "hours": hours})
        conn.commit()
        fresh = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
        result = {
            "order": order_dict(conn, fresh),
            "extension": {
                "hours": hours,
                "amount": price,
                "new_check_out_fmt": show_fmt(new_check_out),
            },
        }
        return 200, result
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


# -------------------------------------------------------- housekeeping ---

def list_tasks(ctx: RouteCtx):
    status = ctx.q("status", "").strip()
    from_raw = ctx.q("from", "").strip()
    to_raw = ctx.q("to", "").strip()
    tasks = hk_svc.get_tasks(ctx.conn, status or None, from_raw or None, to_raw or None)
    return 200, {"tasks": tasks}


def list_staff(ctx: RouteCtx):
    conn = ctx.conn
    now_dt = now()
    today_start = datetime(now_dt.year, now_dt.month, now_dt.day, tzinfo=ECUADOR_TZ)
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
        d = staff_dict(r)
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
    return 200, {"staff": staff}


def create_staff(ctx: RouteCtx):
    conn, sess, hotel_id, data = ctx.conn, ctx.sess or {}, ctx.hotel_id, ctx.data
    name = (data.get("name") or "").strip()
    if not name:
        raise ApiError(400, "name es obligatorio")
    if len(name) > 60:
        raise ApiError(400, "name no puede superar los 60 caracteres")
    try:
        row = fetch_one(
            conn,
            "INSERT INTO housekeeping_staff (hotel_id, name) VALUES (%s, %s) "
            "ON CONFLICT (hotel_id, name) DO UPDATE SET active = TRUE "
            "RETURNING *",
            (hotel_id, name),
        )
        audit(conn, hotel_id, "crear_personal", None, None, sess.get("username"),
              f"Personal de limpieza creado/reactivado: {name}")
        conn.commit()
        result = staff_dict(row)
        ctx.emit("data_changed", {"type": "personal_actualizado", "staff_id": result["id"]})
        return 200, {"staff": result}
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


def deactivate_staff(ctx: RouteCtx):
    conn, sess, hotel_id = ctx.conn, ctx.sess or {}, ctx.hotel_id
    staff_id = int(ctx.path.split("/")[-2])
    try:
        staff = fetch_one(conn, "SELECT * FROM housekeeping_staff WHERE id = %s", (staff_id,))
        if not staff:
            raise ApiError(404, "Personal no encontrado")
        active = fetch_one(
            conn,
            "SELECT id FROM cleaning_tasks WHERE assigned_to = %s "
            "AND status IN ('pendiente', 'en_proceso', 'pausada') ORDER BY id LIMIT 1",
            (staff["name"],),
        )
        if active:
            raise ApiError(400, "Tiene tareas activas; termine o reasigne antes")
        db_exec(conn, "UPDATE housekeeping_staff SET active = FALSE WHERE id = %s", (staff_id,))
        audit(conn, hotel_id, "desactivar_personal", None, None, sess.get("username"),
              f"Personal de limpieza desactivado: {staff['name']}")
        conn.commit()
        staff = fetch_one(conn, "SELECT * FROM housekeeping_staff WHERE id = %s", (staff_id,))
        result = staff_dict(staff)
        ctx.emit("data_changed", {"type": "personal_actualizado", "staff_id": result["id"]})
        return 200, {"staff": result}
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


def assign_staff(ctx: RouteCtx):
    conn, sess, hotel_id, data = ctx.conn, ctx.sess or {}, ctx.hotel_id, ctx.data
    task_id = int(ctx.path.split("/")[-2])
    raw = data.get("staff_name")
    staff_name = raw.strip() if isinstance(raw, str) else ""
    try:
        task = hk_svc.get_cleaning_task(conn, task_id)
        if not task:
            raise ApiError(404, "Tarea de limpieza no encontrada")
        new_name = None
        detail = "Personal desasignado"
        if staff_name and staff_name.lower() != "null":
            staff = fetch_one(
                conn,
                "SELECT * FROM housekeeping_staff WHERE name = %s AND active = TRUE",
                (staff_name,),
            )
            if not staff:
                raise ApiError(400, f"El personal '{staff_name}' no existe o está inactivo")
            new_name = staff["name"]
            detail = f"Personal asignado: {new_name}"
        db_exec(
            conn,
            "UPDATE cleaning_tasks SET assigned_to = %s WHERE id = %s",
            (new_name, task_id),
        )
        audit(conn, hotel_id, "asignar_personal", None, task["room_id"], sess.get("username"),
              f"Tarea #{task_id}: {detail}")
        ctx.emit("limpieza_asignada", {"task_id": task_id, "assigned_to": new_name})
        conn.commit()
        task = hk_svc.get_cleaning_task(conn, task_id)
        result = cleaning_dict(conn, task)
        return 200, {"task": result}
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


def start_task(ctx: RouteCtx):
    conn, sess, hotel_id = ctx.conn, ctx.sess or {}, ctx.hotel_id
    task_id = int(ctx.path.split("/")[-2])
    try:
        old = hk_svc.get_cleaning_task(conn, task_id)
        if not old:
            raise ApiError(404, "Tarea de limpieza no encontrada")
        was_en_proceso = (old["status"] == "en_proceso")
        task = hk_svc.start_task(conn, task_id)
        if not was_en_proceso:
            audit(conn, hotel_id, "housekeeping_start", None, task["room_id"], sess.get("username"),
                  f"Tarea #{task_id} de limpieza iniciada")
        ctx.emit("data_changed", {"type": "limpieza_iniciada", "task_id": task_id})
        conn.commit()
        task = hk_svc.get_cleaning_task(conn, task_id)
        result = cleaning_dict(conn, task)
        return 200, {"task": result}
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


def complete_task(ctx: RouteCtx):
    conn, sess, hotel_id = ctx.conn, ctx.sess or {}, ctx.hotel_id
    task_id = int(ctx.path.split("/")[-2])
    try:
        task, resolved_inc_id = hk_svc.complete_task(conn, task_id, (sess.get("username") or ""))
        # room_id para auditoría desde la tarea fresca
        audit(conn, hotel_id, "housekeeping_complete", None, task["room_id"], sess.get("username"),
              f"Tarea #{task_id} de limpieza completada")
        if resolved_inc_id:
            audit(conn, hotel_id, "incidencia_resuelta", None, task["room_id"], sess.get("username"),
                  f"Incidencia #{resolved_inc_id} resuelta al completar la tarea #{task_id}")
        ctx.emit("data_changed", {"type": "limpieza_completada", "task_id": task_id})
        conn.commit()
        task = hk_svc.get_cleaning_task(conn, task_id)
        result = cleaning_dict(conn, task)
        return 200, {"task": result}
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


def report_incident(ctx: RouteCtx):
    conn, sess, hotel_id, data = ctx.conn, ctx.sess or {}, ctx.hotel_id, ctx.data
    task_id = int(ctx.path.split("/")[-2])
    notes = (data.get("notes") or "").strip()
    try:
        task, inc_row = hk_svc.report_incident(conn, hotel_id, task_id, notes, (sess.get("username") or ""))
        audit(conn, hotel_id, "housekeeping_incident", None, task["room_id"], sess.get("username"),
              f"Tarea #{task_id}: {notes}")
        ctx.emit("data_changed", {"type": "limpieza_incidencia", "task_id": task_id})
        conn.commit()
        task = hk_svc.get_cleaning_task(conn, task_id)
        task_dict = cleaning_dict(conn, task)
        inc_dict = incidence_dict(inc_row)
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
        return 200, {"task": task_dict, "incidence": inc_dict}
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


# ---------------------------------------------------------- incidences ---

def list_incidences(ctx: RouteCtx):
    conn = ctx.conn
    status = ctx.q("status", "").strip()
    if status and status not in INCIDENCE_STATUSES:
        raise ApiError(400, "status inválido (abierta, resuelta)")
    where, params = [], []
    if status:
        where.append("i.status = %s")
        params.append(status)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
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
    result = [incidence_dict(r) for r in rows]
    return 200, {"incidences": result}


def resolve_incidence(ctx: RouteCtx):
    conn, sess, hotel_id = ctx.conn, ctx.sess or {}, ctx.hotel_id
    inc_id = int(ctx.path.split("/")[-2])
    try:
        inc = fetch_one(conn, "SELECT * FROM incidences WHERE id = %s", (inc_id,))
        if not inc:
            raise ApiError(404, "Incidencia no encontrada")
        if inc["status"] == "resuelta":
            raise ApiError(400, "La incidencia ya está resuelta")
        task_id = inc["task_id"]
        task = hk_svc.get_cleaning_task(conn, task_id)
        db_exec(
            conn,
            "UPDATE incidences SET status = 'resuelta', resolved_by = %s, resolved_at = %s "
            "WHERE id = %s",
            (sess.get("username"), now(), inc_id),
        )
        if task and task["status"] == "pausada":
            db_exec(
                conn,
                "UPDATE cleaning_tasks SET status = 'en_proceso' WHERE id = %s",
                (task_id,),
            )
        audit(conn, hotel_id, "incidencia_resuelta", None, inc["room_id"], sess.get("username"),
              f"Incidencia #{inc_id} resuelta (tarea #{task_id})")
        ctx.emit("data_changed", {"type": "limpieza_reanudada", "task_id": task_id})
        conn.commit()
        inc = fetch_one(conn, "SELECT * FROM incidences WHERE id = %s", (inc_id,))
        result = {"incidence": incidence_dict(inc)}
        task = hk_svc.get_cleaning_task(conn, task_id)
        if task:
            result["task"] = cleaning_dict(conn, task)
        return 200, result
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise


# ----------------------------------------------------------- dashboard ---

def dashboard_overview(ctx: RouteCtx):
    return 200, dash_svc.overview(ctx.conn, ctx.hotel_id)


def dashboard_occupancy(ctx: RouteCtx):
    return 200, dash_svc.occupancy(ctx.conn, ctx.hotel_id)


def dashboard_alerts(ctx: RouteCtx):
    return 200, dash_svc.alerts(ctx.conn, ctx.hotel_id)


def close_report(ctx: RouteCtx):
    return 200, dash_svc.close_report(ctx.conn, ctx.hotel_id, ctx.q("date", "").strip())


def daily_report(ctx: RouteCtx):
    return 200, dash_svc.daily_report(ctx.conn, ctx.hotel_id, ctx.q("date", "").strip())


# ------------------------------------------------------------ settings ---

def get_settings(ctx: RouteCtx):
    row = fetch_one(ctx.conn, "SELECT config FROM hotels WHERE id = %s", (ctx.hotel_id,))
    cfg = dict(row["config"] or {}) if row else {}
    cfg.setdefault("reserva_tarifa", 0)
    cfg.setdefault("assign_ttl_minutes", 30)
    cfg.setdefault("cleaning_sla_minutes", 60)
    return 200, {"config": cfg}


def post_settings(ctx: RouteCtx):
    conn, sess, hotel_id, data = ctx.conn, ctx.sess or {}, ctx.hotel_id, ctx.data
    body_cfg = data.get("config")
    if not isinstance(body_cfg, dict):
        raise ApiError(400, "config debe ser un objeto")
    cfg = dict(body_cfg)
    try:
        cfg = validation_svc.validate_hotel_config(dict(cfg))
    except ApiError:
        raise
    except ValueError as e:
        raise ApiError(400, str(e))
    except Exception:
        pass
    if "price_overrides" in cfg and not isinstance(cfg["price_overrides"], dict):
        raise ApiError(400, "price_overrides debe ser un objeto")
    if "branding" in cfg:
        if not isinstance(cfg["branding"], dict):
            raise ApiError(400, "branding debe ser un objeto")
        for k in ("hotel", "tagline"):
            if k in cfg["branding"] and not isinstance(cfg["branding"][k], str):
                raise ApiError(400, f"branding.{k} debe ser texto")
    if "max_days" in cfg:
        try:
            md = int(cfg["max_days"])
        except Exception:
            raise ApiError(400, "max_days debe ser entero 1-30")
        if md < 1 or md > 30:
            raise ApiError(400, "max_days debe estar entre 1 y 30")
        cfg["max_days"] = md
    if "max_days_full" in cfg:
        try:
            mdf = int(cfg["max_days_full"])
        except Exception:
            raise ApiError(400, "max_days_full debe ser entero 1-30")
        if mdf < 1 or mdf > 30:
            raise ApiError(400, "max_days_full debe estar entre 1 y 30")
        cfg["max_days_full"] = mdf
    if "idle_timeout_seconds" in cfg:
        try:
            it = int(cfg["idle_timeout_seconds"])
        except Exception:
            raise ApiError(400, "idle_timeout_seconds debe ser entero 10-600")
        if it < 10 or it > 600:
            raise ApiError(400, "idle_timeout_seconds debe estar entre 10 y 600")
        cfg["idle_timeout_seconds"] = it
    if "promos" in cfg and not isinstance(cfg["promos"], list):
        raise ApiError(400, "promos debe ser una lista")
    if "suite_durations" in cfg and not isinstance(cfg["suite_durations"], dict):
        raise ApiError(400, "suite_durations debe ser un objeto")
    if "qr_url" in cfg and not isinstance(cfg["qr_url"], str):
        raise ApiError(400, "qr_url debe ser texto")
    if "reserva_tarifa" in cfg:
        try:
            rt = float(cfg["reserva_tarifa"])
            if rt < 0 or rt > 1000:
                raise ValueError
        except Exception:
            raise ApiError(400, "reserva_tarifa debe ser número 0-1000")
        cfg["reserva_tarifa"] = rt
    if "assign_ttl_minutes" in cfg:
        try:
            at = int(cfg["assign_ttl_minutes"])
        except Exception:
            raise ApiError(400, "assign_ttl_minutes debe ser entero 5-120")
        if at < 5 or at > 120:
            raise ApiError(400, "assign_ttl_minutes debe estar entre 5 y 120")
        cfg["assign_ttl_minutes"] = at
    if "cleaning_sla_minutes" in cfg:
        try:
            sla = int(cfg["cleaning_sla_minutes"])
        except (TypeError, ValueError):
            raise ApiError(400, "cleaning_sla_minutes debe ser un entero entre 10 y 240")
        if sla < 10 or sla > 240:
            raise ApiError(400, "cleaning_sla_minutes debe estar entre 10 y 240 minutos")
        cfg["cleaning_sla_minutes"] = sla
    kiosco_keys = ("price_overrides", "qr_url", "idle_timeout_seconds", "promos",
                   "max_days", "max_days_full", "suite_durations", "branding")
    kiosco_updates = {k: cfg.pop(k) for k in list(cfg) if k in kiosco_keys}
    try:
        row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s FOR UPDATE", (hotel_id,))
        current = dict(row["config"] or {}) if row else {}
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
        final = dict(current)
        final.update(cfg)
        if kiosco_updates or "kiosco" in final:
            final["kiosco"] = kiosco_now
        db_exec(
            conn,
            "UPDATE hotels SET config = %s::jsonb WHERE id = %s",
            (json.dumps(final), hotel_id),
        )
        audit(conn, hotel_id, "actualizar_config", None, None, sess.get("username"),
              f"Configuración actualizada: {json.dumps(final, ensure_ascii=False)}")
        conn.commit()
        fresh = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (hotel_id,))
        saved = dict(fresh["config"] or {}) if fresh else {}
    except ApiError:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    saved.setdefault("reserva_tarifa", 0)
    saved.setdefault("assign_ttl_minutes", 30)
    saved.setdefault("cleaning_sla_minutes", 60)
    return 200, {"config": saved}


# --------------------------------------------------------------- audit ---

def get_audit(ctx: RouteCtx):
    conn = ctx.conn
    try:
        limit = int(ctx.q("limit", "100"))
    except ValueError:
        raise ApiError(400, "limit debe ser un entero")
    limit = max(1, min(limit, 500))
    try:
        offset = int(ctx.q("offset", "0"))
    except ValueError:
        raise ApiError(400, "offset debe ser un entero")
    if offset < 0:
        raise ApiError(400, "offset debe ser un entero >= 0")
    action = ctx.q("action", "").strip()
    from_raw = ctx.q("from", "").strip()
    to_raw = ctx.q("to", "").strip()
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
    return 200, {"audit": audit_rows, "total": total, "limit": limit, "offset": offset}
