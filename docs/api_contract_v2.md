# Contrato API v2 — CyHotel Multi-tenant

Sistema: PostgreSQL central, multi-hotel, 3 modos de app por contenedor:
- `APP_MODE=kiosco` (puerto 8000, HOTEL_ID fijo) — solo endpoints públicos
- `APP_MODE=admin` (puerto 8001, HOTEL_ID fijo) — API completa del hotel
- `APP_MODE=master` (puerto 8002, sin HOTEL_ID) — agregados de todos los hoteles

Autenticación: Bearer token (12h). Roles: `recepcion`, `housekeeping`, `gerencia` (por hotel), `master` (global).
El usuario master se autentica igual; sus sesiones llevan `scope: 'master'` y la app lo marca como master en `/api/admin/me`.

## Convenciones

- Fechas en respuestas: strings locales `YYYY-MM-DD HH:MM` (America/Guayaquil) — el backend las formatea.
- Dinero: `subtotal` NUMERIC(10,2) en JSON como número; `amount_cents` entero en payments internos.
- Errores: `{"error": "mensaje"}` con HTTP 400/401/403/404/500.
- Toda acción de staff usa la sesión (no `staff_user` en body).
- El frontend usa fetch relativo; las llamadas de datos llevan `Authorization: Bearer <token>`.

## Endpoints existentes (se mantienen, multi-tenant por hotel)

| Método | Ruta | Roles | Notas |
|---|---|---|---|
| POST | /api/admin/login | público | {username,password} → {token,username,role,scope} |
| POST | /api/admin/logout | auth | |
| GET | /api/admin/me | auth | → {username,role,scope} |
| GET | /api/catalog | público | tarifas ROOM_TYPES |
| GET | /api/types?product= | público | disponibilidad por tipo del hotel |
| POST | /api/orders | público (kiosco) | crea orden `por_asignar` sin habitación (client_ref idempotente) |
| GET | /api/rooms | admin | rooms del hotel |
| POST | /api/rooms/:id/status | housekeeping,gerencia | máquina de estados |
| GET | /api/orders?status=&product=&search=&from=&to=&limit=&page= | recepcion,gerencia | filtros + paginación |
| GET | /api/orders/:id | recepcion,gerencia | detalle + items + payments_history |
| POST | /api/orders/:id/assign | recepcion,gerencia | asigna habitación ({room_id} opcional) |
| POST | /api/orders/:id/pay | recepcion,gerencia | {payment_method,payment_reference?,amount?,idempotency_key?} |
| POST | /api/orders/:id/cancel | recepcion,gerencia | {reason} |
| POST | /api/orders/:id/checkout | recepcion,gerencia | finaliza + tarea limpieza |
| GET | /api/reservations?status= | recepcion,gerencia | |
| GET | /api/housekeeping/tasks?status= | housekeeping,gerencia | |
| POST | /api/housekeeping/tasks/:id/start|complete | housekeeping,gerencia | |
| POST | /api/housekeeping/tasks/:id/incident | housekeeping,gerencia | {notes} |
| GET | /api/dashboard/overview | recepcion,gerencia | summary+attention (incluye `to_assign`) |
| GET | /api/dashboard/occupancy | los 3 | |
| GET | /api/audit?limit=&offset=&action=&from=&to= | gerencia | |
| GET | /api/events?token= | auth | SSE: {type:"data_changed", data:{type:...}} |

## Endpoints NUEVOS (P0/P1/P2 + master) — v2

### P0-1 · Cierre de turno / cuadre de caja
- `GET /api/dashboard/close-report?date=YYYY-MM-DD` (recepcion,gerencia) →
  ```json
  {
    "date": "2026-08-15",
    "as_of": "...",
    "summary": {
      "ordenes_creadas": 12, "pagadas": 10, "anuladas": 1, "vencidas": 1,
      "sin_cobrar": 0, "monto_sin_cobrar": 0.0,
      "total_cobrado": 245.50,
      "efectivo": {"count": 6, "total": 120.00},
      "transferencia": {"count": 4, "total": 125.50},
      "por_producto": [{"product": "momento", "label": "Momento", "count": 8, "total": 80.00}, ...]
    },
    "detalle_pagos": [{"payment_id":1,"order_id":5,"room_number":"3","guest_name":"X","method":"efectivo","amount":10.0,"reference":null,"paid_at":"15/08/2026 14:30","recorded_by":"recepcion"}],
    "pagos": {"count": 10, "total": 245.50}
  }
  ```
  Regla: los pagos se cuentan por `payments.paid_at` del día; `monto_sin_cobrar` = suma de subtotales de órdenes `pendiente` no reserva; `sin_cobrar` = count.

### P0-2 · Asignación con límite y prioridad
- overview `attention.to_assign` ya incluye `created_at_fmt` y `waiting_seconds` (minutos esperando).
- `summary.to_assign` igual. El worker **vence órdenes `por_asignar` a los 30 min** de creadas (configurable en `hotels.config.assign_ttl_minutes`, default 30).
- Nuevo campo en atención: `assign_critical` = lista de órdenes con `waiting_seconds > 600` (10 min).

### P0-3 · Extensión de estadía
- `POST /api/orders/:id/extend` (recepcion,gerencia) body `{"extra":"1h"|"6h"}` →
  - Solo órdenes `pagado` o `confirmada` (activas). Rechaza `por_asignar`/`pendiente`/`finalizada`/`vencida`/`anulado`.
  - 1h → sumar $5 (price base del producto? NO: es fijo $5) y +1 hora a check_out.
  - 6h → sumar $20 (fijo) y +6 horas. (Para estándar/matrimonial/suite que tienen extras; doble no tiene → 400 "tipo sin extra".)
  - Crea payment adicional (method según body `payment_method` requerido, reference opcional, idempotency_key opcional), suma al `orders.subtotal` el monto, actualiza `updated_at`.
  - Respuesta `{"order": {...}, "extension": {"hours":1,"amount":5.0,"new_check_out_fmt":"..."}}`.
  - Montos: 1h=$5, 6h=$20 (constantes del negocio, no del catálogo).

### P0-4 · Badges de alerta
- `GET /api/dashboard/alerts` (auth) → `{"to_assign":2,"pending_payments":3,"departures_overdue":1,"cleaning":2}` (counts actuales, para sidebar).

### P1-1 · Reporte diario completo
- `GET /api/dashboard/daily-report?date=YYYY-MM-DD` (gerencia) →
  ```json
  {
    "date": "...",
    "por_producto": [{"product":"momento","label":"Momento","creadas":8,"pagadas":7,"anuladas":1,"total_cobrado":70.0}],
    "por_metodo": [{"method":"efectivo","label":"Efectivo","count":6,"total":120.0}],
    "por_tipo_habitacion": [{"type":"estandar","label":"Habitación Estándar","ordenes":8}],
    "ocupacion_pico": {"hora":"20:00","ocupadas":14,"total":19,"pct":73.7},
    "anuladas": [{"id":3,"guest_name":"X","reason":"motivo","created_at_fmt":"..."}],
    "limpieza": {"completadas":4,"pendientes":1,"promedio_minutos":23}
  }
  ```
  `ocupacion_pico` = máximo de habitaciones ocupadas a la vez ese día (calculado cruzando check_in/check_out por hora). `limpieza.promedio_minutos` = avg(completed_at - started_at) del día.

### P1-2 · Tiempo de limpieza
- Incluido en daily-report (`limpieza`) + `GET /api/housekeeping/tasks?status=completada&from=&to=` ya filtrable por fecha (agregar `from`/`to`).

### P2-1 · Tarifa de reserva configurable
- `GET /api/hotel/settings` (recepcion,gerencia) → `{"config":{"reserva_tarifa":25.0,"assign_ttl_minutes":30}}`
- `POST /api/hotel/settings` (gerencia) body `{"config":{...}}` → actualiza `hotels.config`. Cuando `reserva_tarifa` > 0, el pay de reserva **no exige** amount (usa la tarifa por defecto si no se envía amount).

### Master
- `GET /api/master/hotels` (master) → `{"hotels":[{"id":1,"slug":"hoteldelvalle","nombre":"Hotel del Valle","activo":true,"rooms_total":19,"libres":5,"ocupadas":12,"en_limpieza":2,"bloqueadas":0,"ocupacion_pct":63.2}]}`
- `GET /api/master/dashboard` (master) → agregados de todos los hoteles:
  ```json
  {
    "as_of":"...",
    "totales":{"hoteles":1,"cuartos":19,"libres":5,"ocupadas":12,"en_limpieza":2,"bloqueadas":0,"ocupacion_pct":63.2},
    "por_hotel":[{"id":1,"nombre":"Hotel del Valle","ocupadas":12,"en_limpieza":2,"ingresos_hoy":245.5,"pagos_pendientes":3,"to_assign":1,"salidas_vencidas":0}],
    "ingresos_hoy":245.5,
    "pagos_hoy":{"efectivo":120.0,"transferencia":125.5},
    "por_producto":[{"product":"momento","label":"Momento","count":8,"total":80.0}],
    "salidas_vencidas":0,
    "limpieza_pendiente":2
  }
  ```
- `GET /api/master/orders?hotel_id=&status=&from=&to=&limit=&page=` (master) → lista de órdenes de todos/hotel.
- El master NO usa `/api/dashboard/*` del hotel; usa `/api/master/*`.

## Notas de implementación (server.py)

- Un solo `server.py` con `APP_MODE` (kiosco/admin/master). En modo kiosco SOLO se sirven: /api/catalog, /api/types, /api/orders POST, estáticos kiosco. En admin: todo del hotel. En master: login master + /api/master/* + /api/admin/me + estáticos web-master.
- `HOTEL_ID` env: admin/kiosco la usan (y `set_app_hotel`); master no la fija (scope master).
- El worker de vencimientos corre en el contenedor admin (un solo worker global, multi-hotel: itera hoteles activos).
- SSE `/api/events` broadcast global (los paneles admin reaccionan y refrescan su hotel; el master refresca todo).
- `storage/rooms/*.jpg` fotos: por hotel (`storage/<hotel_slug>/rooms/...`), servidas por /uploads/ con el hotel de la sesión (o público para kiosco con su HOTEL_ID).
