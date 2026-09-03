"""Master routes — scope master, sin HOTEL_ID (Fase 3).

Handlers con ctx explícito; retornan (status, payload) o lanzan ApiError.
SQL/JSON idénticos a server.py:master_*.
"""
import math
from datetime import datetime, timedelta

from db import fetch_one, fetch_all
from app.routes.common import ApiError, RouteCtx, num, now, parse_date_local, order_dict, PRODUCT_LABELS, ECUADOR_TZ


def master_routes():
    return [
        "GET /api/master/hotels",
        "GET /api/master/dashboard",
        "GET /api/master/orders",
    ]


def get_hotels(ctx: RouteCtx):
    conn = ctx.conn
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
        """,
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
    return 200, {"hotels": hotels}


def get_dashboard(ctx: RouteCtx):
    conn = ctx.conn
    now_dt = now()
    day_start = datetime(now_dt.year, now_dt.month, now_dt.day, tzinfo=ECUADOR_TZ)
    day_end = day_start + timedelta(days=1)
    room_rows = fetch_all(
        conn,
        """
        SELECT r.hotel_id, COUNT(r.id) AS rooms_total,
               COUNT(r.id) FILTER (WHERE r.status = 'libre') AS libres,
               COUNT(r.id) FILTER (WHERE r.status = 'ocupado') AS ocupadas,
               COUNT(r.id) FILTER (WHERE r.status = 'en_limpieza') AS en_limpieza,
               COUNT(r.id) FILTER (WHERE r.status = 'bloqueado') AS bloqueadas
        FROM rooms r GROUP BY r.hotel_id
        """,
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
    return 200, {
        "as_of": now_dt.isoformat(),
        "totales": totales,
        "por_hotel": por_hotel,
        "ingresos_hoy": round(ingresos_hoy, 2),
        "pagos_hoy": {k: round(v, 2) for k, v in pagos_hoy.items()},
        "por_producto": por_producto,
        "salidas_vencidas": sum(p["salidas_vencidas"] for p in por_hotel),
        "limpieza_pendiente": limpieza_pendiente,
    }


def list_orders(ctx: RouteCtx):
    from app.routes.common import ORDER_STATUSES

    conn = ctx.conn
    hotel_raw = ctx.q("hotel_id", "").strip()
    status = ctx.q("status", "").strip()
    from_raw = ctx.q("from", "").strip()
    to_raw = ctx.q("to", "").strip()
    try:
        limit = int(ctx.q("limit", "50"))
        page = int(ctx.q("page", "1"))
    except ValueError:
        raise ApiError(400, "limit y page deben ser enteros")
    limit = max(1, min(limit, 200))
    page = max(1, page)
    hotel_id = None
    if hotel_raw:
        try:
            hotel_id = int(hotel_raw)
        except ValueError:
            raise ApiError(400, "hotel_id debe ser un entero")
    if status and status not in ORDER_STATUSES:
        raise ApiError(400, "status inválido")

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

    total = int(fetch_one(conn, f"SELECT COUNT(*) AS n FROM orders o {where_sql}", params)["n"])
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
    result = [order_dict(conn, r) for r in rows]
    return 200, {"orders": result, "total": total, "page": page, "pages": pages}
