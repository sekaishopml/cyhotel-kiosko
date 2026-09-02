"""Pricing service — single source para GET /types y POST /orders (Fase 1 fix + Fase 2 extracción)."""
from db import ROOM_TYPES
from db import fetch_one

def get_price_overrides(conn, hotel_id, hotel_config_fn):
    """Lee price_overrides del hotel; soporta 2 formas, devuelve {} si vacío."""
    try:
        cfg = hotel_config_fn(conn, hotel_id)
    except Exception:
        return {}
    kiosco = cfg.get("kiosco")
    kiosco = kiosco if isinstance(kiosco, dict) else {}
    po = kiosco.get("price_overrides") if "price_overrides" in kiosco else cfg.get("price_overrides")
    if not isinstance(po, dict):
        return {}
    return po

def apply_price_override(overrides, key, default_price, extra_key=None):
    base = overrides.get(key)
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
    if isinstance(base, dict):
        extras = base.get("extras")
    else:
        extras = None
    if isinstance(extras, dict) and extra_key in extras:
        val = extras.get(extra_key)
        if isinstance(val, (int, float)):
            try:
                return float(val)
            except (TypeError, ValueError):
                return default_price
    return default_price

def suite_subtotal(overrides, base_price, extra):
    """Subtotal para suite con overrides (momento/amanecida/hospedaje)."""
    subtotal = float(base_price)
    suite_ov = overrides.get("suite")
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
        alt = apply_price_override(overrides, "suite", base_price)
        if alt != base_price and extra == "momento":
            subtotal = float(alt)
    except Exception:
        pass
    return subtotal
