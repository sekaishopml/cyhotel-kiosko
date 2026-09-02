"""Re-export db.py pool y helpers para import limpio."""
from backend.db import (
    db,
    release_conn,
    _admin_db,
    set_app_hotel,
    exec,
    fetch_one,
    fetch_all,
    hash_password,
    verify_password,
    init_db,
)
