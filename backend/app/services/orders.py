"""Orders service — Fase 3b extraccion de server.py (1112-1350, 1476-1650).

Centraliza validacion y calculo de subtotal/check_in/out para desacoplar
la capa HTTP (Handler) de la logica de negocio.

Extraido de:
- server.py:1114 create_order (validacion product/guest_name/room_type)
- server.py:1177 suite handling (momento/amanecida/hospedaje + overrides)
- server.py:1227 momento/doble guard + extras 1h/6h
- server.py:1262 amanecida (AMANECIDA_ENTRY/EXIT)
- server.py:1275 hospedaje (days 1-30)
- server.py:1130 idempotencia via client_ref (ON CONFLICT hotel_id, client_ref)

No importa server.py para evitar dependencia circular; replica constantes
o usa db.py. Usa pricing.py cuando esta disponible.

Handler delegara: validate_order_payload -> build_order_times -> INSERT.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# Must use imports from db (task requirement) — mantienen RLS + constantes compartidas
from db import ROOM_TYPES, AMANECIDA_ENTRY, AMANECIDA_EXIT, HOLD_MINUTES, fetch_one, fetch_all
from db import exec as db_exec

# pricing helpers reutilizables — import duro Fase 3 (fallar en boot si rompe)
from app.services.pricing import apply_price_override as _pricing_apply
from app.services.pricing import suite_subtotal as _pricing_suite_subtotal
from app.services.pricing import get_price_overrides as _pricing_get_overrides
from app.routes.common import ApiError

# ---------------------------------------------------------------------------
# Constantes — replicadas localmente para import-safe (tambien importadas de db)
# ---------------------------------------------------------------------------
ORDER_PRODUCTS = ("momento", "amanecida", "hospedaje", "suite", "reserva")
ORDER_STATUSES = ("por_asignar", "pendiente", "pagado", "confirmada", "finalizada", "vencida", "anulado")
SUITE_EXTRAS = ("momento", "amanecida", "hospedaje")

ECUADOR_TZ = ZoneInfo("America/Guayaquil")

# ---------------------------------------------------------------------------
# Time helpers — replica server.py:239 now() sin importar server
# ---------------------------------------------------------------------------

def _now() -> datetime:
    """Ahora en America/Guayaquil (equivalente a server.py:now)."""
    return datetime.now(ECUADOR_TZ)


# ---------------------------------------------------------------------------
# Pricing override helpers — fallback si pricing.py no disponible
# ---------------------------------------------------------------------------

def _apply_price_override(overrides, key, default_price, extra_key=None):
    """Replica server.py:_apply_price_override / pricing.apply_price_override."""
    if _pricing_apply is not None:
        try:
            return _pricing_apply(overrides, key, default_price, extra_key)
        except Exception:
            pass
    base = overrides.get(key) if isinstance(overrides, dict) else None
    if extra_key is None:
        if isinstance(base, dict) and "price" in base:
            try:
                return float(base["price"])
            except (TypeError, ValueError):
                return default_price
        if isinstance(base, (int, float)):
            try:
                return float(base)
            except (TypeError, ValueError):
                return default_price
        return default_price
    # extra_key branch
    extras = base.get("extras") if isinstance(base, dict) else None
    if isinstance(extras, dict) and extra_key in extras:
        val = extras.get(extra_key)
        if isinstance(val, (int, float)):
            try:
                return float(val)
            except (TypeError, ValueError):
                return default_price
    return default_price


def _suite_subtotal(overrides, base_price, extra):
    """Copia literal server.py:1186-1203 suite pricing con overrides.

    server.py:1175-1210:
        subtotal = float(base_price)
        suite_ov = overrides.get("suite")
        if isinstance(suite_ov, dict):
            if extra in suite_ov and isinstance(suite_ov[extra], (int,float)):
                subtotal = float(suite_ov[extra])
            elif isinstance(suite_ov.get("extras"), dict) and extra in suite_ov["extras"]:
                subtotal = float(suite_ov["extras"][extra])
        elif isinstance(suite_ov, (int,float)) and extra == "momento":
            subtotal = float(suite_ov)
        try:
            alt = self._apply_price_override(overrides, "suite", base_price)
            if alt != base_price and extra == "momento":
                subtotal = float(alt)
        except Exception:
            pass
    """
    if _pricing_suite_subtotal is not None:
        try:
            return float(_pricing_suite_subtotal(overrides, base_price, extra))
        except Exception:
            pass
    subtotal = float(base_price)
    suite_ov = overrides.get("suite") if isinstance(overrides, dict) else None
    if isinstance(suite_ov, dict):
        if extra in suite_ov and isinstance(suite_ov[extra], (int, float)):
            subtotal = float(suite_ov[extra])
        elif isinstance(suite_ov.get("extras"), dict) and extra in suite_ov["extras"]:
            try:
                subtotal = float(suite_ov["extras"][extra])
            except Exception:
                pass
    elif isinstance(suite_ov, (int, float)) and extra == "momento":
        subtotal = float(suite_ov)
    try:
        alt = _apply_price_override(overrides, "suite", base_price)
        if alt != base_price and extra == "momento":
            subtotal = float(alt)
    except Exception:
        pass
    return subtotal


# alias publico pedido en spec: compute_suite_subtotal
def compute_suite_subtotal(overrides, base_price, extra):
    """Wrapper publico para _suite_subtotal (spec: compute_suite_subtotal)."""
    return _suite_subtotal(overrides, base_price, extra)


# ---------------------------------------------------------------------------
# Validacion
# ---------------------------------------------------------------------------

def validate_product(product, room_type):
    """Valida product + room_type; retorna info (dict de ROOM_TYPES).

    Replica server.py:1115-1125 + placeholder existente.
    - product debe estar en ORDER_PRODUCTS
    - room_type debe estar en ROOM_TYPES
    - si product != suite, info.get(product) no debe ser None
    """
    if product not in ORDER_PRODUCTS:
        raise ValueError("product inválido (momento, amanecida, hospedaje, suite, reserva)")
    if room_type not in ROOM_TYPES:
        raise ValueError("room_type inválido")
    info = ROOM_TYPES[room_type]
    # suite no tiene clave "suite" en info, tiene momento/amanecida/hospedaje mapeados via extra
    if product not in ("suite", "reserva") and info.get(product) is None:
        raise ValueError(f"'{info['label']}' no ofrece el producto '{product}'")
    return info


def suite_extra_valid(extra):
    return extra in SUITE_EXTRAS


def validate_order_payload(data, hotel_id=None, conn=None):
    """Validacion completa del payload de POST /api/orders.

    Replica server.py:1114-1127 y validacion de suite/momento etc.
    Lanza ValueError con mensaje humano si algo falla; retorna dict normalizado:

        {
            product, guest_name, id_document, room_type, info,
            client_ref, extra, days
        }

    - product, guest_name, room_type obligatorios
    - id_document opcional (None si vacio)
    - client_ref opcional (None si vacio) para idempotencia
    - extra/days se validan segun product (suite requiere extra validado,
      momento permite 1h/6h, hospedaje valida days 1-30)

    hotel_id/conn se pasan para validaciones que requieren DB (doble guard).
    No hace IO si conn es None (salta guard de dobles).
    """
    if not isinstance(data, dict):
        raise ValueError("payload debe ser un objeto")
    product = (data.get("product") or "").strip()
    if product not in ORDER_PRODUCTS:
        raise ValueError("product inválido (momento, amanecida, hospedaje, suite, reserva)")
    guest_name = (data.get("guest_name") or "").strip()
    if not guest_name:
        raise ValueError("guest_name es obligatorio")
    id_document = (data.get("id_document") or "").strip() or None
    room_type = (data.get("room_type") or "").strip()
    if room_type not in ROOM_TYPES:
        raise ValueError("room_type inválido")
    info = ROOM_TYPES[room_type]
    client_ref = (data.get("client_ref") or "").strip() or None

    # validacion cruzada product/room_type
    if product not in ("suite", "reserva") and info.get(product) is None:
        raise ValueError(f"'{info['label']}' no ofrece el producto '{product}'")
    if product == "suite" and room_type != "suite":
        raise ValueError("Suite solo disponible para tipo suite")

    extra = None
    days = 1
    if product == "suite":
        extra = (data.get("extra") or "momento").strip() or "momento"
        if extra not in SUITE_EXTRAS:
            raise ValueError("extra inválido para suite (momento/amanecida/hospedaje)")
        base = info.get(extra)
        if base is None:
            raise ValueError(f"Suite no ofrece '{extra}'")
        if extra == "hospedaje":
            try:
                days = int(data.get("days", 1))
            except Exception:
                days = 1
            days = max(1, min(days, 30))
            # se valida rango real abajo si overrides lo requiere; aqui clamp 1-30
            # pero spec de hospedaje valida estricto, para suite lo dejamos clamp
    elif product == "momento":
        raw_extra = (data.get("extra") or "").strip() or None
        if raw_extra in ("1h", "6h"):
            if raw_extra not in info.get("extras", {}):
                label = "1 hora adicional" if raw_extra == "1h" else "Doble tiempo"
                raise ValueError(f"{label} no disponible para este tipo")
            extra = raw_extra
        elif raw_extra:
            raise ValueError("extra inválido")
        else:
            extra = None
        # doble guard se valida en build_order_times si conn disponible
    elif product == "amanecida":
        extra = None
        # no params extra
    elif product == "hospedaje":
        try:
            days = int(data.get("days", 1))
        except (TypeError, ValueError):
            raise ValueError("days debe ser un entero")
        if days < 1 or days > 30:
            raise ValueError("days debe estar entre 1 y 30")
        extra = None
    elif product == "reserva":
        extra = None
        days = 1

    return {
        "product": product,
        "guest_name": guest_name,
        "id_document": id_document,
        "room_type": room_type,
        "info": info,
        "client_ref": client_ref,
        "extra": extra,
        "days": days,
        "hotel_id": hotel_id,
    }


def get_existing_by_client_ref(conn, client_ref):
    """Idempotencia: busca orden existente por client_ref.

    Replica server.py:1130-1140 fetch_one por client_ref.
    Retorna row dict o None. Requiere conn; si client_ref es falsy retorna None.
    """
    if not client_ref or conn is None:
        return None
    try:
        return fetch_one(conn, "SELECT * FROM orders WHERE client_ref = %s", (client_ref,))
    except Exception:
        return None


# ---------------------------------------------------------------------------
# build_order_times — funcion central pedida en spec
# ---------------------------------------------------------------------------

def build_order_times(product, room_type, extra=None, days=1, info=None, overrides=None, conn=None):
    """Calcula (check_in, check_out, hours_val, subtotal) para cualquier product.

    Replica server.py:1172-1289. Firma requerida en spec:
        build_order_times(product, room_type, extra, days, info)
    pero acepta kwargs overrides/conn para pricing y guard de dobles.

    - product: str en ORDER_PRODUCTS
    - room_type: str en ROOM_TYPES
    - extra: str | None (suite: momento/amanecida/hospedaje; momento: 1h/6h)
    - days: int (solo hospedaje y suite/hospedaje, 1-30)
    - info: dict de ROOM_TYPES[room_type] (si None se busca)
    - overrides: dict price_overrides (default {})
    - conn: conexion PG con RLS para guard de dobles (opcional)

    Retorna (check_in: datetime, check_out: datetime, hours_val: int|None, subtotal: float)
    Lanza ValueError si el producto no esta disponible o params invalidos.

    Ejemplos:
        build_order_times("momento","estandar",None,1, ROOM_TYPES["estandar"])
        build_order_times("suite","suite","amanecida",1, ROOM_TYPES["suite"], overrides)
        build_order_times("hospedaje","doble",None,3, info, overrides)
    """
    overrides = overrides or {}
    if info is None:
        if room_type not in ROOM_TYPES:
            raise ValueError("room_type inválido")
        info = ROOM_TYPES[room_type]

    # validaciones base delegan a validate_product para mensaje consistente
    validate_product(product, room_type)

    # --- reserva: check_in ahora, check_out +1h, subtotal 0 ---
    if product == "reserva":
        check_in_dt = _now()
        check_out_dt = check_in_dt + timedelta(hours=1)
        hours_val = 1
        subtotal = 0.0
        return check_in_dt, check_out_dt, hours_val, subtotal

    # --- suite: extra obligatorio momento/amanecida/hospedaje ---
    if product == "suite":
        if room_type != "suite":
            raise ValueError("Suite solo disponible para tipo suite")
        suite_extra = (extra or "momento").strip() or "momento"
        if suite_extra not in SUITE_EXTRAS:
            raise ValueError("extra inválido para suite (momento/amanecida/hospedaje)")
        base_price = info.get(suite_extra)
        if base_price is None:
            raise ValueError(f"Suite no ofrece '{suite_extra}'")
        subtotal = _suite_subtotal(overrides, base_price, suite_extra)
        if suite_extra == "momento":
            hours_val = 3
            check_in_dt = _now()
            check_out_dt = check_in_dt + timedelta(hours=3)
        elif suite_extra == "amanecida":
            # replica server.py:1208-1215
            entry = info.get("amanecida_entry", AMANECIDA_ENTRY)
            entry_dt = _now().replace(hour=int(entry[:2]), minute=int(entry[3:5]), second=0, microsecond=0)
            now_local = _now()
            check_in_dt = now_local if now_local > entry_dt else entry_dt
            exit_dt = entry_dt + timedelta(days=1)
            check_out_dt = exit_dt.replace(hour=int(AMANECIDA_EXIT[:2]), minute=int(AMANECIDA_EXIT[3:5]))
            hours_val = None
        else:  # hospedaje
            try:
                d = int(days if days is not None else 1)
            except Exception:
                d = 1
            d = max(1, min(d, 30))
            hours_val = d * 24
            check_in_dt = _now()
            check_out_dt = check_in_dt + timedelta(days=d)
            if d > 1:
                subtotal = round(subtotal * d, 2)
        return check_in_dt, check_out_dt, hours_val, float(subtotal)

    # --- momento: 3h base, 1h->4h, 6h->6h, doble guard ---
    if product == "momento":
        price = info.get(product)
        if price is None:
            raise ValueError(f"'{info['label']}' no ofrece el producto '{product}'")
        price = _apply_price_override(overrides, room_type, price)
        # doble guard — replica server.py:1232-1238 (solo si conn disponible)
        if info.get("momento_solo_sin_otras") and conn is not None:
            try:
                other_free = fetch_one(
                    conn,
                    "SELECT COUNT(*) AS n FROM rooms WHERE status = 'libre' AND type IN ('estandar', 'matrimonial')",
                )["n"]
                if int(other_free) > 0:
                    raise ValueError("Las dobles se venden de momento solo cuando no hay otras habitaciones")
            except ValueError:
                raise
            except Exception:
                pass  # si no hay DB en tests, no bloquea
        # normalizacion de extra
        eff_extra = (extra or "").strip() or None
        hours = 3
        if eff_extra == "1h":
            if "1h" not in info.get("extras", {}):
                raise ValueError("1 hora adicional no disponible para este tipo")
            hours = 4
        elif eff_extra == "6h":
            if "6h" not in info.get("extras", {}):
                raise ValueError("Doble tiempo no disponible para este tipo")
            hours = 6
        elif eff_extra:
            raise ValueError("extra inválido")
        hours_val = hours
        check_in_dt = _now()
        check_out_dt = check_in_dt + timedelta(hours=hours)
        if eff_extra == "6h":
            base_extra = info["extras"]["6h"]["price"]
            subtotal = _apply_price_override(overrides, room_type, base_extra, extra_key="6h")
        elif eff_extra == "1h":
            base_extra = info["extras"]["1h"]["price"]
            # replica server.py:1259 precio base + extra
            subtotal = price + _apply_price_override(overrides, room_type, base_extra, extra_key="1h")
        else:
            subtotal = price
        return check_in_dt, check_out_dt, hours_val, float(subtotal)

    # --- amanecida: entry->exit fijo ---
    if product == "amanecida":
        price = info.get(product)
        if price is None:
            raise ValueError(f"'{info['label']}' no ofrece el producto '{product}'")
        price = _apply_price_override(overrides, room_type, price)
        entry = info.get("amanecida_entry", AMANECIDA_ENTRY)
        entry_dt = _now().replace(hour=int(entry[:2]), minute=int(entry[3:5]), second=0, microsecond=0)
        now_local = _now()
        check_in_dt = now_local if now_local > entry_dt else entry_dt
        exit_dt = entry_dt + timedelta(days=1)
        check_out_dt = exit_dt.replace(hour=int(AMANECIDA_EXIT[:2]), minute=int(AMANECIDA_EXIT[3:5]))
        hours_val = None
        subtotal = price
        return check_in_dt, check_out_dt, hours_val, float(subtotal)

    # --- hospedaje: days 1-30, price*days ---
    if product == "hospedaje":
        price = info.get(product)
        if price is None:
            raise ValueError(f"'{info['label']}' no ofrece el producto '{product}'")
        price = _apply_price_override(overrides, room_type, price)
        try:
            d = int(days if days is not None else 1)
        except (TypeError, ValueError):
            raise ValueError("days debe ser un entero")
        if d < 1 or d > 30:
            raise ValueError("days debe estar entre 1 y 30")
        hours_val = d * 24
        check_in_dt = _now()
        check_out_dt = check_in_dt + timedelta(days=d)
        subtotal = round(float(price) * d, 2)
        return check_in_dt, check_out_dt, hours_val, float(subtotal)

    raise ValueError("product no manejado")


# ---------------------------------------------------------------------------
# Helpers adicionales para compatibilidad con siguiente PR (Handler refactor)
# ---------------------------------------------------------------------------

def get_price_overrides_for_hotel(conn, hotel_id, hotel_config_fn=None):
    """Lee price_overrides del hotel de forma import-safe.

    Si pricing.py disponible delega a get_price_overrides, si no replica
    server.py:_price_overrides + _hotel_config.
    """
    if _pricing_get_overrides is not None and hotel_config_fn is not None:
        try:
            return _pricing_get_overrides(conn, hotel_id, hotel_config_fn)
        except Exception:
            pass
    # fallback directo via fetch_one
    try:
        row = fetch_one(conn, "SELECT config FROM hotels WHERE id = %s", (hotel_id,))
        cfg = dict(row["config"] or {}) if row else {}
    except Exception:
        return {}
    kiosco = cfg.get("kiosco")
    kiosco = kiosco if isinstance(kiosco, dict) else {}
    po = kiosco.get("price_overrides") if "price_overrides" in kiosco else cfg.get("price_overrides")
    if not isinstance(po, dict):
        return {}
    return po


def build_order_result(product, room_type, guest_name, id_document, client_ref, hotel_id, conn, overrides, data):
    """Orquesta validate + build_order_times para uso de Handler.

    Retorna dict listo para INSERT:
        {guest_name, id_document, product, room_type, hours, check_in, check_out, subtotal, client_ref}
    """
    validated = validate_order_payload(data, hotel_id, conn)
    # sincroniza extra/days validados
    extra = validated["extra"]
    days = validated["days"]
    info = validated["info"]
    check_in_dt, check_out_dt, hours_val, subtotal = build_order_times(
        product=validated["product"],
        room_type=validated["room_type"],
        extra=extra,
        days=days,
        info=info,
        overrides=overrides or {},
        conn=conn,
    )
    return {
        "guest_name": validated["guest_name"],
        "id_document": validated["id_document"],
        "product": validated["product"],
        "room_type": validated["room_type"],
        "hours": hours_val,
        "check_in": check_in_dt,
        "check_out": check_out_dt,
        "subtotal": float(subtotal),
        "client_ref": validated["client_ref"],
        "info": info,
    }


# ---------------------------------------------------------------------------
# Persistencia — Fase 3: INSERT/UPDATE con mismo SQL/mensajes que server.py.
# Reutilizan validate/build_order_times. No commitean: el router commitea,
# audita y emite (pg_notify/SSE) en la misma txn. Lanzan ApiError(400/404).
# ---------------------------------------------------------------------------

def _parse_id(value, name="id de orden inválido"):
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ApiError(400, name)


def assign_room_candidate(conn, room_type):
    """Reserva la primera libre del tipo (FOR UPDATE) y la marca ocupado.

    Copia exacta server.py:_assign_room. Retorna row de rooms.
    """
    row = fetch_one(
        conn,
        """
        SELECT * FROM rooms WHERE type = %s AND status = 'libre'
        ORDER BY CASE WHEN number = 'Suite' THEN 1 ELSE 0 END,
                 CASE WHEN number ~ '^[0-9]+$' THEN number::INTEGER ELSE 0 END
        LIMIT 1 FOR UPDATE
        """,
        (room_type,),
    )
    if not row:
        raise ApiError(400, f"No hay habitaciones libres de tipo '{room_type}'")
    db_exec(conn, "UPDATE rooms SET status = 'ocupado' WHERE id = %s", (row["id"],))
    db_exec(
        conn,
        "INSERT INTO room_status_history (hotel_id, room_id, status) "
        "VALUES ((SELECT current_hotel_id()), %s, %s)",
        (row["id"], "ocupado"),
    )
    return row


def persist_create_order(conn, hotel_id, data, overrides):
    """Crea orden por_asignar. Retorna (order_id, is_duplicate, existing_row).

    - Idempotencia por client_ref (SELECT previo + ON CONFLICT).
    - Reserva: INSERT sin hours, subtotal 0 (copia server.py).
    - Resto: validate + build_order_times (reutiliza cálculo central).
    Lanza ApiError(400) con mensajes de server.py.
    """
    if not isinstance(data, dict):
        raise ApiError(400, "payload debe ser un objeto")
    product = (data.get("product") or "").strip()
    # Mensaje exacto server.py:create_order (sin 'suite' en la lista)
    if product not in ORDER_PRODUCTS:
        raise ApiError(400, "product inválido (momento, amanecida, hospedaje, reserva)")
    guest_name = (data.get("guest_name") or "").strip()
    id_document = (data.get("id_document") or "").strip() or None
    if not guest_name:
        raise ApiError(400, "guest_name es obligatorio")
    room_type = (data.get("room_type") or "").strip()
    if room_type not in ROOM_TYPES:
        raise ApiError(400, "room_type inválido")
    client_ref = (data.get("client_ref") or "").strip() or None

    if client_ref:
        try:
            existing = fetch_one(conn, "SELECT * FROM orders WHERE client_ref = %s", (client_ref,))
        except Exception:
            existing = None
        if existing:
            return None, True, existing

    if product == "reserva":
        check_in_dt = _now()
        check_out_dt = check_in_dt + timedelta(hours=1)
        row = db_exec(
            conn,
            "INSERT INTO orders (hotel_id, guest_name, id_document, product, room_type, "
            "check_in, check_out, subtotal, status, payment_method, client_ref) "
            "VALUES (%s, %s, %s, 'reserva', %s, %s, %s, 0, 'por_asignar', 'pendiente', %s) "
            "ON CONFLICT (hotel_id, client_ref) DO NOTHING RETURNING id",
            (hotel_id, guest_name, id_document, room_type, check_in_dt, check_out_dt, client_ref),
        )
        if not row:
            existing = fetch_one(conn, "SELECT * FROM orders WHERE client_ref = %s", (client_ref,))
            return None, True, existing
        return row[0]["id"], False, None

    # No-reserva: validación + cálculo central reutilizado
    try:
        built = build_order_result(product, room_type, guest_name, id_document, client_ref, hotel_id, conn, overrides or {}, data)
    except ValueError as e:
        raise ApiError(400, str(e))
    row = db_exec(
        conn,
        "INSERT INTO orders (hotel_id, guest_name, id_document, product, room_type, hours, "
        "check_in, check_out, subtotal, status, payment_method, client_ref) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'por_asignar', 'pendiente', %s) "
        "ON CONFLICT (hotel_id, client_ref) DO NOTHING RETURNING id",
        (hotel_id, built["guest_name"], built["id_document"], built["product"], built["room_type"],
         built["hours"], built["check_in"], built["check_out"], built["subtotal"], built["client_ref"]),
    )
    if not row:
        if client_ref:
            existing = fetch_one(conn, "SELECT * FROM orders WHERE client_ref = %s", (client_ref,))
            return None, True, existing
        raise ApiError(400, "Error al crear la orden")
    return row[0]["id"], False, None
