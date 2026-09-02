"""Orders service — Fase 2 placeholder para extracción completa (Fase 3).
Actualmente la lógica de create_order vive en server.py y usa pricing service.
Este módulo centralizará validación y cálculo de subtotal para 8 hoteles.
"""
from db import ROOM_TYPES

ORDER_PRODUCTS = ("momento", "amanecida", "hospedaje", "suite", "reserva")

def validate_product(product, room_type):
    if product not in ORDER_PRODUCTS:
        raise ValueError("product inválido (momento, amanecida, hospedaje, suite, reserva)")
    if room_type not in ROOM_TYPES:
        raise ValueError("room_type inválido")
    info = ROOM_TYPES[room_type]
    if product != "suite" and info.get(product) is None:
        raise ValueError(f"'{info['label']}' no ofrece el producto '{product}'")
    return info

def suite_extra_valid(extra):
    return extra in ("momento", "amanecida", "hospedaje")
