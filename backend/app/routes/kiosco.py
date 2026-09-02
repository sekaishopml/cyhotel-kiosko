"""Kiosco routes — GET /api/types, /api/catalog, /api/kiosco-*, POST /api/orders."""
# Futuro: funciones handle_* que reciben (handler_self, conn, params) y retornan payload.
# Por ahora: documentación y helpers compartidos.

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
