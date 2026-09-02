"""Validation service — validación de hotels.config y payloads (Fase 3)."""

def validate_hotel_config(cfg):
    """Valida dict config (lo que entra en POST /api/hotel/settings -> config).
    Lanza ValueError con mensaje humano si algo no cumple. Mutará cfg para normalizar tipos.
    """
    if not isinstance(cfg, dict):
        raise ValueError("config debe ser un objeto")
    # price_overrides
    if "price_overrides" in cfg and not isinstance(cfg["price_overrides"], dict):
        raise ValueError("price_overrides debe ser un objeto")
    if "branding" in cfg:
        if not isinstance(cfg["branding"], dict):
            raise ValueError("branding debe ser un objeto")
        for k in ("hotel", "tagline"):
            if k in cfg["branding"] and not isinstance(cfg["branding"][k], str):
                raise ValueError(f"branding.{k} debe ser texto")
    if "max_days" in cfg:
        try:
            md = int(cfg["max_days"])
        except Exception:
            raise ValueError("max_days debe ser entero 1-30")
        if md < 1 or md > 30:
            raise ValueError("max_days debe estar entre 1 y 30")
        cfg["max_days"] = md
    if "max_days_full" in cfg:
        try:
            mdf = int(cfg["max_days_full"])
        except Exception:
            raise ValueError("max_days_full debe ser entero 1-30")
        if mdf < 1 or mdf > 30:
            raise ValueError("max_days_full debe estar entre 1 y 30")
        cfg["max_days_full"] = mdf
    if "idle_timeout_seconds" in cfg:
        try:
            it = int(cfg["idle_timeout_seconds"])
        except Exception:
            raise ValueError("idle_timeout_seconds debe ser entero 10-600")
        if it < 10 or it > 600:
            raise ValueError("idle_timeout_seconds debe estar entre 10 y 600")
        cfg["idle_timeout_seconds"] = it
    if "promos" in cfg and not isinstance(cfg["promos"], list):
        raise ValueError("promos debe ser una lista")
    if "suite_durations" in cfg and not isinstance(cfg["suite_durations"], dict):
        raise ValueError("suite_durations debe ser un objeto")
    if "qr_url" in cfg and not isinstance(cfg["qr_url"], str):
        raise ValueError("qr_url debe ser texto")
    if "reserva_tarifa" in cfg:
        try:
            rt = float(cfg["reserva_tarifa"])
            if rt < 0 or rt > 1000:
                raise ValueError
        except Exception:
            raise ValueError("reserva_tarifa debe ser número 0-1000")
        cfg["reserva_tarifa"] = rt
    if "assign_ttl_minutes" in cfg:
        try:
            at = int(cfg["assign_ttl_minutes"])
        except Exception:
            raise ValueError("assign_ttl_minutes debe ser entero 5-120")
        if at < 5 or at > 120:
            raise ValueError("assign_ttl_minutes debe estar entre 5 y 120")
        cfg["assign_ttl_minutes"] = at
    if "cleaning_sla_minutes" in cfg:
        try:
            sla = int(cfg["cleaning_sla_minutes"])
        except Exception:
            raise ValueError("cleaning_sla_minutes debe ser un entero entre 10 y 240")
        if sla < 10 or sla > 240:
            raise ValueError("cleaning_sla_minutes debe estar entre 10 y 240 minutos")
        cfg["cleaning_sla_minutes"] = sla
    return cfg
