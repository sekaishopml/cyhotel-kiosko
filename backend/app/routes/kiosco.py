"""Kiosco routes — funciones con ctx explícito (Fase 3).

Cada handler recibe un RouteCtx (conn con RLS, sess, hotel_id, data, qs, path)
y retorna (status_code, payload) o lanza ApiError. Sin cambiar SQL/JSON/mensajes.
"""
from db import ROOM_TYPES, AMANECIDA_ENTRY, AMANECIDA_EXIT, fetch_one, fetch_all
from app.routes.common import ApiError, RouteCtx, order_dict, get_hotel_config
from app.services.pricing import apply_price_override, get_price_overrides
from app.services import orders as orders_svc


def kiosco_routes():
    return [
        "GET /api/catalog",
        "GET /api/types?product=",
        "GET /api/kiosco-config",
        "GET /api/kiosco-version",
        "GET /api/kiosco-update",
        "POST /api/orders",
        "POST /api/kiosco-crash",
    ]


def get_catalog(ctx: RouteCtx):
    return 200, {
        "types": ROOM_TYPES,
        "amanecida_entry": AMANECIDA_ENTRY,
        "amanecida_exit": AMANECIDA_EXIT,
    }


def _query_product(ctx: RouteCtx):
    product = ctx.q("product", "")
    if product not in ("momento", "amanecida", "hospedaje", "suite", "reserva"):
        raise ApiError(400, "product inválido (momento, amanecida, hospedaje, suite, reserva)")
    return product


def get_types(ctx: RouteCtx):
    from app.routes.common import ORDER_PRODUCTS  # noqa: F401 (documenta enum válido)

    product = _query_product(ctx)
    conn, hotel_id = ctx.conn, ctx.hotel_id
    try:
        overrides = get_price_overrides(conn, hotel_id, get_hotel_config)
    except Exception:
        overrides = {}
    free_by_type = {}
    for row in fetch_all(conn, "SELECT type, COUNT(*) AS n FROM rooms WHERE status = 'libre' GROUP BY type"):
        free_by_type[row["type"]] = int(row["n"])
    other_free = sum(n for t, n in free_by_type.items() if t in ("estandar", "matrimonial"))
    photo_for = lambda key: "/img/suite.jpeg" if key == "suite" else "/img/habitacion.jpeg"
    merge_am = product in ("amanecida", "hospedaje")
    result = []
    for key, info in ROOM_TYPES.items():
        if merge_am and key == "matrimonial":
            continue
        free = free_by_type.get(key, 0)
        if merge_am and key == "estandar":
            free = free_by_type.get("estandar", 0) + free_by_type.get("matrimonial", 0)
            info = {
                **info,
                "label": "Sencilla Matrimonial",
                "desc": "Sencilla o matrimonial (la matrimonial es más amplia, con nevera y baño con mampara). A/C, TV Smart, WiFi, agua caliente, bebidas y piqueos",
            }
        if product == "reserva":
            result.append({
                "key": key,
                "label": info["label"],
                "desc": info["desc"],
                "photo": photo_for(key),
                "price": None,
                "free": free,
                "eligible": free > 0,
                "reason": None if free > 0 else "No hay habitaciones libres de este tipo",
                "extras": {},
            })
            continue
        if product == "suite":
            if key == "suite":
                price = info.get("momento")
                price = apply_price_override(overrides, key, price)
                _entry = info.get("amanecida_entry", AMANECIDA_ENTRY)
                extras = {
                    "momento": {"label": "Momento (3h)", "price": info.get("momento", 0)},
                    "amanecida": {"label": f"Amanecida ({_entry}-{AMANECIDA_EXIT})", "price": info.get("amanecida", 0)},
                    "hospedaje": {"label": "Hospedaje (por noche)", "price": info.get("hospedaje", 0)},
                }
            else:
                price = None
                extras = {}
        elif product in ("momento", "amanecida", "hospedaje") and key == "suite":
            price = None
            extras = {}
        else:
            price = info.get(product)
            price = apply_price_override(overrides, key, price)
            extras = {} if product == "amanecida" else (info.get("extras") or {})
            if isinstance(extras, dict):
                extras = {ek: dict(ev) for ek, ev in extras.items()}
                for ek, ev in extras.items():
                    ev["price"] = apply_price_override(overrides, key, ev.get("price", 0), extra_key=ek)
        if price is None:
            continue
        eligible, reason = True, None
        if product == "momento" and info.get("momento_solo_sin_otras"):
            eligible = free > 0 and other_free == 0
            if not eligible:
                reason = "Solo se vende de momento cuando no hay otras habitaciones"
        elif free == 0:
            eligible, reason = False, "No hay habitaciones disponibles de este tipo"
        result.append({
            "key": key,
            "label": info["label"],
            "desc": info["desc"],
            "photo": photo_for(key),
            "price": price,
            "free": free,
            "eligible": eligible,
            "reason": reason,
            "extras": extras,
        })
    return 200, {"product": product, "types": result}


def get_kiosco_config(ctx: RouteCtx):
    from app.routes.common import local_str as _ls  # noqa: F401 (mantiene import simétrico con server)

    defaults = {
        "max_days": 7,
        "max_days_full": 15,
        "qr_url": "",
        "idle_timeout_seconds": 60,
        "promos": [{"title": "Amanecida 18:00-09:00", "subtitle": "Desde $20"}],
        "price_overrides": {},
        "branding": {"hotel": "Hotel Del Valle", "tagline": "Tu descanso, tu espacio"},
        "suite_durations": {"momento": 20, "amanecida": 35, "hospedaje": 50},
    }
    try:
        cfg = get_hotel_config(ctx.conn, ctx.hotel_id)
    except Exception:
        cfg = {}
    kiosco = cfg.get("kiosco")
    kiosco = kiosco if isinstance(kiosco, dict) else {}

    def pick(key):
        if key in kiosco and kiosco[key] is not None:
            return kiosco[key]
        if key in cfg and cfg[key] is not None:
            return cfg[key]
        return defaults[key]

    config = {}
    for key, default in defaults.items():
        value = pick(key)
        if key in ("price_overrides", "branding", "suite_durations", "promos"):
            if not isinstance(value, dict if key != "promos" else list):
                value = default
        config[key] = value
    if isinstance(config["promos"], dict):
        config["promos"] = defaults["promos"]
    return 200, {"config": config}


def create_order(ctx: RouteCtx):
    """POST /api/orders (kiosco/admin público). Persiste vía orders service.

    Mensajes/status idénticos a server.py:create_order (201 creado,
    200 duplicado, 400 validación). Reserva devuelve message dentro de order.
    """
    from app.routes.common import audit, local_str

    conn, hotel_id, data = ctx.conn, ctx.hotel_id, ctx.data
    try:
        try:
            overrides = get_price_overrides(conn, hotel_id, get_hotel_config)
        except Exception:
            overrides = {}
        order_id, is_dup, existing = orders_svc.persist_create_order(conn, hotel_id, data, overrides)
        if is_dup:
            conn.commit()
            return 200, {
                "order": order_dict(conn, existing),
                "message": "Solicitud duplicada: se devuelve la orden existente",
            }
        product = (data.get("product") or "").strip()
        if product == "reserva":
            audit(conn, hotel_id, "crear_reserva", order_id, None, "kiosco",
                  f"Reserva {(data.get('room_type') or '').strip()} desde {local_str(existing_check_in(conn, order_id))} (mín. 1 hora, esperando asignación)")
            ctx.emit("data_changed", {"type": "reserva_creada", "order_id": order_id})
            conn.commit()
            order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
            result = order_dict(conn, order)
            result["message"] = "Reserva registrada"
            return 201, {"order": result}
        # No-reserva: subtotal para auditoría desde la fila creada
        created = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
        try:
            _sub = float(created["subtotal"])
        except Exception:
            _sub = 0.0
        audit(conn, hotel_id, "crear_orden", order_id, None, "kiosco",
              f"{created['guest_name']}: {created['product']} ${_sub:.2f} (esperando asignación)")
        ctx.emit("data_changed", {"type": "orden_creada", "order_id": order_id, "room_id": None})
        conn.commit()
        order = fetch_one(conn, "SELECT * FROM orders WHERE id = %s", (order_id,))
        return 201, {"order": order_dict(conn, order)}
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


def existing_check_in(conn, order_id):
    row = fetch_one(conn, "SELECT check_in FROM orders WHERE id = %s", (order_id,))
    return row["check_in"] if row else None
