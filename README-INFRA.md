# cyhotel-deploy — Infraestructura Docker (multi-tenant)

> Ver `docs/ARCHITECTURE.md` para C4 y ADRs. Este archivo es el manual operativo.

Despliegue Docker del sistema hotelero multi-tenant. Un solo código backend
Python ejecutado con tres `APP_MODE` distintos, más PostgreSQL 16 como base
central.

## Arquitectura

| Servicio | APP_MODE | Rol | Puerto host | Expuesto fuera |
|---|---|---|---|---|
| db | — | PostgreSQL 16 (Alpine) | ninguno | no |
| kiosco | kiosco | Público: solo sirve `/kiosco` y endpoints públicos | 8000 | sí |
| admin | admin | Panel del hotel del valle (HOTEL_ID=1) | 8001 | sí |
| master | master | Panel gerencia/contabilidad (todos los hoteles) | 8002 | sí |

- Los tres contenedores usan el mismo `Dockerfile` con `ARG APP_MODE`.
- `db` NO publica el puerto 5432 al host por seguridad; solo red interna
  `backend`. Para administración local opcional se puede descomentar en
  `docker-compose.yml`:
  `ports: ["127.0.0.1:5432:5432"]` (solo accesible desde el propio VPS).
- Los datos viven en el volumen `pgdata` (sobrevive a `docker-compose down`).

## Requisitos previos

- Ubuntu 22.04, Docker 29, docker-compose 1.29 (v1, compatible con el formato
  v3.8 de este proyecto).
- El backend debe estar listo para PostgreSQL (el backend siembra hoteles y
  usuarios en el primer arranque, no hay script de seed separado).

## Puesta en marcha

```bash
cd /home/CyHotel
docker-compose up -d --build
docker-compose ps
```

Orden de arranque: `db` se levanta primero y `kiosco`/`admin`/`master`
esperan a que `db` pase el healthcheck (`pg_isready`) antes de arrancar
(`depends_on: condition: service_healthy`).

Primer arranque: el backend crea las tablas y siembra hoteles/usuarios
automáticamente al iniciarse contra la base vacía. No es necesario ningún
script de seed manual.

## Operación diaria

Ver logs:

```bash
docker-compose logs -f --tail=200 db
docker-compose logs -f --tail=200 admin
```

Reiniciar un servicio:

```bash
docker-compose restart admin
```

Reconstruir tras cambios en backend/ o web/:

```bash
docker-compose up -d --build
```

Detener sin borrar datos:

```bash
docker-compose down
```

## Backups

Script: `scripts/backup.sh`

```bash
sudo /home/CyHotel/scripts/backup.sh
```

Crea `/var/backups/cyhotel/` y genera `cyhotel_<fecha>.sql.gz` con
`pg_dump`, borrando los backups con más de 7 días.

Programar en cron (root):

```bash
sudo crontab -e
```

Añadir la línea (03:00 diario):

```
0 3 * * * /home/CyHotel/scripts/backup.sh
```

### Restaurar un backup

Requiere que `db` esté levantado (método rápido para pruebas, vacía la base
actual):

```bash
cd /home/CyHotel
docker-compose exec -T db dropdb -U cyhotel --if-exists cyhotel
docker-compose exec -T db createdb -U cyhotel cyhotel
gunzip -c /var/backups/cyhotel/cyhotel_YYYYMMDD_HHMM.sql.gz | \
  docker-compose exec -T db psql -U cyhotel -d cyhotel
```

Luego reiniciar las apps para que se sincronicen: `docker-compose restart`.

## Puertos y acceso

- Kiosco: http://<IP_VPS>:8000/kiosco
- Admin: http://<IP_VPS>:8001/admin
- Master: http://<IP_VPS>:8002

Las credenciales seed (usuario/contraseña iniciales) se documentan en el
README del backend, no en este archivo.

## Plan de transición desde el sistema actual

El sistema actual (single hotel, SQLite) corre en systemd como `cyhotel` en el
puerto 8000 y **no debe tocarse** hasta que el nuevo sistema pase QA.

1. Levantar la pila nueva: `docker-compose up -d --build`.
2. Ejecutar QA contra el puerto 8000 (kiosco nuevo) — convive con el
   systemd actual mientras dure la prueba.
3. Cuando QA pase, desactivar el sistema antiguo:

```bash
systemctl stop cyhotel
systemctl disable cyhotel
```

4. El puerto 8000 queda entonces libre y sigue siendo servido por el
   contenedor `kiosco`.

Para revertir (volver al systemd) durante la transición:
`systemctl enable --now cyhotel` y `docker-compose stop kiosco`.

## nginx/

Todavía NO se configura. Este directorio se usará más adelante cuando se
añadan HTTPS y dominios (proxy reverso hacia los puertos 8000/8001/8002,
certificados con Let's Encrypt). Hasta entonces las apps se sirven
directamente por puerto.

## Auditoría de ingeniería de base de datos (senior SQL review)

Realizada el 2026-08-16. Cambios aplicados y verificados:

1. **FK de hotel faltantes** — orders, payments, cleaning_tasks y
   room_status_history no tenían FOREIGN KEY a hotels(id); solo users y rooms.
   Agregadas las 4 constraints (6 FKs totales a hotels). Previene huérfanos y
   delete accidental de un hotel con datos.

2. **Deadlock sin retry** — el worker acumulaba locks en una transacción larga
   por hotel mientras assign/pay/checkout bloquean órdenes y esperan
   habitaciones: ciclo clásico de deadlock (1 detectado en el QA de
   concurrencia). Se agregó retry automático en do_POST para las rutas
   críticas (assign/pay/cancel/checkout/extend/room-status/housekeeping):
   reintenta hasta 3 veces con backoff ante `DeadlockDetected` y
   `SerializationFailure`. El cliente ya no recibe 500 por contención; la
   operación se reintenta con la transacción completa (conexión nueva).

3. **Worker sin filtro de tenant en queries candidates** — solo confiaba en
   RLS, por lo que el planner no podía usar los índices compuestos
   (hotel_id, status, ...). Se agregó `hotel_id = %s` explícito en las 4
   queries candidates del worker (expire_paid/pending/unassigned/holds).
   Ahora usa Index Scan: (hotel_id, status, check_out) y
   (hotel_id, product, status, hold_expires_at).

4. **Índices faltantes** — agregados:
   - `idx_cleaning_room_status (hotel_id, room_id, status)` — usado por
     set_room_status y la cola de limpieza.
   - `idx_orders_hold (hotel_id, product, status, hold_expires_at)` — worker
     de reservas.
   - `idx_orders_room_type (hotel_id, room_type, status)` — disponibilidad
     por tipo (reportes futuros).

Verificación post-cambio: Ronda 1 (20/20) + Ronda 2 (10/10) del QA completo
re-ejecutadas en verde; concurrencia worker+assigns sin 500s; EXPLAIN
confirma Index Scan en las queries calientes; 4 contenedores respondiendo.

### Recomendaciones futuras (cuando escale a 8 hoteles)

- **Connection pooling**: hoy cada request abre una conexión nueva (psycopg2).
  Con 8 hoteles considerar pgbouncer o un pool local (psycopg2.pool) para
  límites de conexiones y latencia.
- **Aislamiento de transacciones**: el retry de deadlock cubre la contención;
  si el volumen crece mucho, revisar si alguna operación necesita
  `REPEATABLE READ` (hoy READ COMMITTED es correcto para asignación/pago).
- **Backup PITR**: para continuidad 24/7, considerar archivo WAL (wal_level
  replica + pg_basebackup) además del pg_dump diario.
- **PgBouncer en modo transaction** si hay picos de requests simultáneos.

## Tiempo real entre procesos (PostgreSQL LISTEN/NOTIFY)

El kiosco (8000), el admin (8001) y el master (8002) son contenedores
separados: el broadcast SSE en memoria no cruzaba procesos, por lo que el
pedido hecho en la tablet no aparecía en el panel hasta el refresh manual.

Solución: puente via PostgreSQL LISTEN/NOTIFY (canal `cyhotel_changed`).

- El kiosco hace `pg_notify_change()` dentro de la transacción al crear una
  orden (se entrega en COMMIT) — y lo mismo hacen todos los mutadores del
  admin (assign/pay/checkout/extend/estado/limpieza).
- admin y master corren un hilo `notify_listener_loop` que escucha el canal
  y re-emite el evento a sus clientes SSE locales conectados.
- El panel del hotel reacciona en ~20-25 ms: "Atender ahora" muestra el
  check-in por asignar y el mapa cambia a modo asignación al instante, sin
  pulsar Actualizar.

Verificado: tablet->admin 23 ms, tablet->master 24 ms. Rondas 1 y 2 del QA
re-ejecutadas en verde tras el cambio.
