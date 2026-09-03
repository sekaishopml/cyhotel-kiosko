"""Rooms service — extracción de server.py (Fase 3).

Funciones puras que operan sobre una conexión PG con RLS ya seteado.
No hacen _send/_error; lanzan ValueError o retornan dicts.
"""
import os

from db import ROOM_TYPES, fetch_one, fetch_all
from db import exec as db_exec
from app.routes.common import ApiError

# Paths — replican server.py BASE_DIR/STORAGE_DIR sin importar server
_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
STORAGE_DIR = os.path.abspath(os.path.join(_BASE_DIR, "..", "storage"))
ROOMS_PHOTO_DIR = os.path.join(STORAGE_DIR, "rooms")
STORAGE_DIR_ABS = STORAGE_DIR

ROOM_STATUS_TRANSITIONS = {
    "libre": ("en_limpieza", "bloqueado"),
    "en_limpieza": ("libre", "bloqueado"),
    "bloqueado": ("libre", "en_limpieza"),
}

def _slug_for(conn, hotel_id):
    if not hotel_id:
        return None
    row = fetch_one(conn, "SELECT slug FROM hotels WHERE id = %s", (hotel_id,))
    return row["slug"] if row else None

def _photo_url(conn, number, hotel_id):
    # intenta storage/<slug>/rooms/<number>.jpg luego storage/rooms/<number>.jpg
    slug = _slug_for(conn, hotel_id) if hotel_id else None
    if slug and os.path.isfile(os.path.join(STORAGE_DIR, slug, "rooms", f"{number}.jpg")):
        return f"/uploads/{slug}/rooms/{number}.jpg"
    if os.path.isfile(os.path.join(ROOMS_PHOTO_DIR, f"{number}.jpg")):
        return f"/uploads/rooms/{number}.jpg"
    return None

def room_dict(conn, row, hotel_id):
    d = dict(row)
    info = ROOM_TYPES.get(d["type"]) or {}
    d["label"] = info.get("label", d["type"])
    d["photo"] = _photo_url(conn, d["number"], hotel_id)
    return d

def list_rooms(conn, hotel_id):
    rows = fetch_all(conn, "SELECT * FROM rooms ORDER BY id")
    return [room_dict(conn, r, hotel_id) for r in rows]

def list_available(conn, hotel_id):
    rows = fetch_all(conn, "SELECT * FROM rooms WHERE status = 'libre' ORDER BY id")
    return [room_dict(conn, r, hotel_id) for r in rows]

def set_room_status(conn, hotel_id, room_id, status, reason, username):
    """Valida FSM y muta rooms + cleaning_tasks. Retorna {room, task}.

    Mensajes y SQL idénticos a server.py:set_room_status (contrato v2).
    Lanza ApiError(400/404). No commitea/audita: el router lo hace.
    """
    if status not in ("libre", "en_limpieza", "bloqueado"):
        raise ApiError(400, "status debe ser: libre, en_limpieza o bloqueado")
    reason = reason.strip() if isinstance(reason, str) else ""
    if len(reason) > 200:
        raise ApiError(400, "reason no puede superar los 200 caracteres")
    if status != "bloqueado":
        reason = ""

    room = fetch_one(conn, "SELECT * FROM rooms WHERE id = %s FOR UPDATE", (room_id,))
    if not room:
        raise ApiError(404, "Cuarto no encontrado")
    old = room["status"]
    if old == "ocupado":
        raise ApiError(400, "El cuarto está ocupado por una orden activa; use checkout o anule la orden primero")
    valid = ROOM_STATUS_TRANSITIONS.get(old, ())
    if old == status or status not in valid:
        raise ApiError(
            400,
            f"Transición inválida: {old} -> {status}. "
            f"Desde '{old}' las transiciones válidas son: {', '.join(valid) or 'ninguna'}",
        )
    if old == "en_limpieza" and status == "libre":
        active = fetch_one(
            conn,
            "SELECT id FROM cleaning_tasks WHERE room_id = %s AND status IN ('pendiente', 'en_proceso', 'incidencia') ORDER BY id LIMIT 1",
            (room_id,),
        )
        if active:
            raise ApiError(
                400,
                f"Hay una tarea de limpieza activa (#{active['id']}). Completela o marque incidencia antes de liberar la habitación",
            )

    db_exec(conn, "UPDATE rooms SET status = %s WHERE id = %s", (status, room_id))
    db_exec(conn, "INSERT INTO room_status_history (hotel_id, room_id, status) VALUES ((SELECT current_hotel_id()), %s, %s)", (room_id, status))

    created_task = None
    if status == "en_limpieza":
        active = fetch_one(
            conn,
            "SELECT id FROM cleaning_tasks WHERE room_id = %s AND status IN ('pendiente', 'en_proceso', 'incidencia') ORDER BY id LIMIT 1",
            (room_id,),
        )
        if not active:
            db_exec(
                conn,
                "INSERT INTO cleaning_tasks (hotel_id, room_id, order_id, status) VALUES (%s, %s, NULL, 'pendiente') RETURNING id",
                (hotel_id, room_id),
            )
            task_row = fetch_one(
                conn,
                "SELECT * FROM cleaning_tasks WHERE room_id = %s AND status = 'pendiente' AND order_id IS NULL ORDER BY id DESC LIMIT 1",
                (room_id,),
            )
            if task_row:
                # lazy import para evitar ciclo
                try:
                    from app.services.housekeeping import cleaning_dict as _cd
                    # need conn for sla fields, but avoid import loop
                    created_task = dict(task_row)
                except Exception:
                    created_task = dict(task_row)

    return room, created_task
