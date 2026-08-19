# Hotel del Valle — Kiosco de check-in y panel admin

Sistema de autoservicio para tablet (kiosco táctil, intocable por el huésped
desde lo funcional) + panel administrativo con login y roles para el staff del
Hotel del Valle (Guayaquil). Diseñado para que un huésped cualquiera — abuelo o
niño — pueda completar un check-in en máximo 3 toques.

## Estructura

```
CyHotel/
├── brand/                    Marca: estrategia, identidad visual, brand kit
├── plan_checkin_hotel.txt    Documento histórico del plan original
├── backend/
│   ├── db.py                 Esquema SQLite + migración + seed (19 habitaciones, 3 usuarios)
│   ├── server.py             API central (Python stdlib, sin dependencias) + worker
│   └── hotel.db              Base de datos (se genera al iniciar)
├── storage/rooms/            Fotos de habitaciones: <numero>.jpg (pendientes)
└── web/
    ├── kiosco.html           Kiosco táctil: plan → habitación → check-in (3 pantallas)
    └── admin.html            Panel del staff (login + roles)
```

## Ejecutar

```bash
cd /home/CyHotel
python3 backend/server.py
```

- Kiosco:   http://localhost:8000/kiosco
- Admin:    http://localhost:8000/admin
- Público:  http://68.168.20.219:8000/kiosco y /admin (puerto 8000 abierto en ufw)

Servicio de sistema (auto-reinicio): `systemctl status cyhotel`.

Toda la hora del sistema usa la zona horaria **America/Guayaquil**.

## Acceso al admin

Credenciales de seed (se crean la primera vez que se inicia la base;
las contraseñas se definen con las variables de entorno `CYHOTEL_SEED_*_PASS`,
ver `/home/CyHotel/.env` fuera del repo — no se versionan):

| Usuario   | Contraseña            | Rol                  |
|-----------|-----------------------|----------------------|
| admin     | `CYHOTEL_SEED_ADMIN_PASS`   | gerencia             |
| recepcion | `CYHOTEL_SEED_RECEPCION_PASS` | recepcion            |
| limpieza  | `CYHOTEL_SEED_LIMPIEZA_PASS` | limpieza (housekeeping) |

**AVISO: cambiar estas contraseñas antes de producción** (la base se re-seedea
solo si la tabla `users` está vacía).

## Inventario y tarifas (confirmadas)

19 habitaciones. Momentos: 3 h desde el ingreso (4 h con extra +1 h, 6 h con
doble tiempo). Amanecida: entra 18:00 (suite 19:00), sale 9:00. Hospedaje: por
días, 1 a 30 (el kiosco ofrece 1 a 7); subtotal = tarifa × días.

| Tipo | Habitaciones | Momento 3h | +1h | 6h | Amanecida | Hospedaje |
|---|---|---|---|---|---|---|
| Estándar | 1,2,3,4,5,7,8,9,11,12,13 | $10 | $5 | $20 | $20 (18:00→9:00) | $30/día |
| Matrimonial | 10,16,17,18,19 | $12 | $5 | $24 | $20 (18:00→9:00) | — (no ofrece) |
| Doble (2 camas) | 14,15 | $12 (solo si no hay otras libres) | — | — | $30 (18:00→9:00) | $40/día |
| Suite con jacuzzi | Suite | $20 | $5 | $40 | $35 (19:00→9:00) | $50/día |

- Las dobles se venden de momento **solo cuando no hay otras habitaciones
  libres** (estándar o matrimonial); no tienen extras.
- Reserva: registra la entrada en el mismo momento, checkout mínimo 1 hora,
  asigna la primera habitación libre del tipo y la retiene 30 min sin pago
  (hold). Subtotal inicial $0: la tarifa la define recepción con el campo
  `amount` al confirmar el pago.
- El cuarto se asigna automáticamente: el primero libre del tipo elegido
  (números en orden, Suite al final).
- Datos del huésped: nombre (obligatorio) y cédula (opcional). Pago en efectivo
  o transferencia, confirmado por el staff en el sistema.

## Estados de orden

| Estado | Semántica |
|---|---|
| `pendiente` | Creada sin pago; la habitación queda retenida (reserva) u ocupada |
| `pagado` | Pago confirmado por el staff (momento/amanecida/hospedaje) |
| `confirmada` | Reserva pagada y vigente |
| `finalizada` | Checkout manual del staff o vencida por el worker; habitación → `en_limpieza` |
| `vencida` | Sin pago y pasado el check_out, o reserva que superó el hold de 30 min; habitación → `libre` |
| `anulado` | Cancelada por el staff (solo órdenes pendientes); habitación → `libre` |

## Base de datos

- Tabla `orders` con columnas nuevas: `paid_at`, `paid_by`, `hold_expires_at`
  (reservas), `updated_at`, más `payment_reference`, `client_ref`
  (idempotencia) y `checked_out_at`.
- **`payments`**: histórico de pagos por orden (monto en centavos USD, método,
  referencia, `paid_at`, `recorded_by`, `idempotency_key`). El pago se registra
  desde la sesión del staff (`recorded_by`) y deja `paid_at`/`paid_by` en la
  orden; las reservas sin tarifa fijan el monto con `amount` en `/pay`.
- **`cleaning_tasks`**: tareas de limpieza por habitación/orden con estados
  `pendiente`, `en_proceso`, `completada`, `incidencia`.
- **`room_status_history`**: historial de cambios de estado de habitaciones.
- Migración automática de `orders` al arrancar si faltan columnas (preserva
  datos; a las reservas previas se les computa `hold_expires_at` = creada + 30 min).

## Worker automático

Un hilo en el servidor ejecuta una pasada cada ~35 segundos:

1. Estadías pagadas/confirmadas cuyo `check_out` ya pasó → `finalizada`, la
   habitación pasa a `en_limpieza` y se crea una tarea de limpieza `pendiente`.
2. Órdenes pendientes (no reservas) con `check_out` pasado → `vencida` y la
   habitación pasa a `libre`.
3. Reservas pendientes que superaron los 30 min de hold → `vencida` y la
   habitación pasa a `libre`.

Todo queda registrado en `audit_log` (acciones `liberacion_automatica`,
`orden_vencida`, `reserva_expirada`, con `staff_user = 'sistema'`) y en
`room_status_history`.

## Endpoints API

**Autenticación:** la mayoría de los endpoints requieren
`Authorization: Bearer <token>` (token obtenido en `POST /api/admin/login`,
válido 12 h). Roles: `recepcion`, `limpieza` (housekeeping), `gerencia`.
Públicos (sin token): `GET /api/types`, `GET /api/catalog`, `POST /api/orders`.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | /api/admin/login | — | Login del staff → `{token, username, role}` |
| POST | /api/admin/logout | cualquiera | Cierra la sesión |
| GET | /api/admin/me | cualquiera | Usuario y rol de la sesión |
| GET | /api/catalog | — | Tipos, tarifas y horarios de amanecida |
| GET | /api/types?product=… | — | Tipos elegibles + precios por producto (momento/amanecida/hospedaje/reserva) |
| GET | /api/rooms | recepcion, limpieza, gerencia | Habitaciones con estado |
| GET | /api/rooms/available | recepcion, limpieza, gerencia | Solo libres |
| POST | /api/rooms/:id/status | limpieza, gerencia | Cambiar a libre / en_limpieza / bloqueado (no si está ocupada) |
| POST | /api/orders | — | Crear orden (momento/amanecida/hospedaje/reserva); idempotente con `client_ref` |
| GET | /api/orders | recepcion, gerencia | Órdenes con filtros y paginación (ver abajo) |
| GET | /api/orders/:id | recepcion, gerencia | Detalle de orden + historial de pagos |
| GET | /api/reservations | recepcion, gerencia | Reservas (filtro `status`, límite) |
| POST | /api/orders/:id/pay | recepcion, gerencia | Confirma pago (efectivo/transferencia); en reservas acepta `amount`; idempotente con `idempotency_key` |
| POST | /api/orders/:id/cancel | recepcion, gerencia | Anula y libera cuarto (solo pendientes) |
| POST | /api/orders/:id/checkout | recepcion, gerencia | Finaliza orden pagada/confirmada; cuarto → `en_limpieza` + tarea de limpieza |
| GET | /api/housekeeping/tasks | limpieza, gerencia | Tareas de limpieza (filtro `status`) |
| POST | /api/housekeeping/tasks/:id/start | limpieza, gerencia | Marca tarea `en_proceso` |
| POST | /api/housekeeping/tasks/:id/complete | limpieza, gerencia | Marca tarea `completada` |
| POST | /api/housekeeping/tasks/:id/incident | limpieza, gerencia | Reporta incidencia con `notes` (obligatorio) |
| GET | /api/dashboard/overview | recepcion, gerencia | Resumen: ocupación, pagos pendientes, holds, salidas, limpieza, actividad reciente |
| GET | /api/dashboard/occupancy | limpieza, recepcion, gerencia | Ocupación por tipo de habitación |
| GET | /api/audit | gerencia | Auditoría con filtros (ver abajo) |

**Filtros y paginación:**

- `GET /api/orders`: `status`, `product`, `search` (nombre, número de cuarto o
  id), `from`, `to` (fechas), `limit` (1–200, default 50), `page` → responde
  `{orders, total, page, pages}`.
- `GET /api/audit`: `action`, `from`, `to`, `limit` (1–500, default 100).
- `GET /api/reservations`: `status` (pendiente, confirmada, vencida, anulado), `limit`.

Todas las acciones de staff quedan registradas en `audit_log` (quién, cuándo,
qué cambió).

## Flujo operativo

- Checkout (manual o automático por el worker) → habitación `en_limpieza` +
  tarea de limpieza `pendiente`.
- El personal de limpieza inicia la tarea (`en_proceso`) y la completa
  (`completada`); si hay daños o novedades reporta una `incidencia` con notas.
- Tarea completada → el staff marca la habitación `libre` con
  `POST /api/rooms/:id/status` para que vuelva a venderse.
- Los pagos siempre se registran desde la sesión del staff (`recorded_by` /
  `paid_by`); no existe entrada manual de staff para pagos.

## Seguridad

- CORS: solo mismo origen (el servidor no emite `Access-Control-Allow-Origin`).
- HTTPS: **pendiente** (hoy se sirve por HTTP en el puerto 8000).
- Contraseñas con PBKDF2-SHA256 (100 000 iteraciones, salt fijo por usuario);
  tokens de sesión de 12 h. Cédula del huésped opcional (campo `id_document`).

## Fotos de habitaciones

Colocar las fotos en `storage/rooms/<numero>.jpg` (ej: `1.jpg`, `Suite.jpg`);
se sirven en `/uploads/rooms/<numero>.jpg` y el kiosco y el admin las muestran
automáticamente. Hasta entonces se muestran placeholders elegantes.

## Pendientes de confirmación del cliente

- Tarifa oficial de Reservas (hoy $0 + `amount` manual al cobrar).
- Política de cancelación/reembolso.
- Máximo de días de hospedaje (hoy 30 en el backend; la UI ofrece 1–7).
- Entrega de llaves (flujo físico post-check-in).
- Facturación SRI.
