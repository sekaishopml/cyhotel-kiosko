# Hotel del Valle — Kiosco (App híbrida nativa + web)

App de check-in táctil para tablet, pensada para personas mayores: tipografía grande y elegante, **sin scroll**, diseño fluido que se adapta a la pantalla (probado en tablet de 8").

Es una **app híbrida**: un `android-shell` nativo (WebView, modo quiosco) que muestra el frontend React. La interfaz es 100% web y, además, viene **empaquetada dentro del APK** como respaldo offline.

## Arquitectura 24/7

```
                 ┌──────────────────────────────────────────────┐
                 │  TABLET (Innovatech P8, Android 12)          │
                 │  APK Kiosko (WebView)                        │
                 │   ├─ Carga UI del server (fácil update)      │
                 │   └─ FALLBACK: UI local en el APK (file://)  │
                 │   └─ Cola offline: guarda check-ins y        │
                 │      los reenvía sola cuando vuelve red     │
                 └───────────┬───────────────────┬──────────────┘
              LAN del hotel  │                   │  (si WAN cae, sigue
                             ▼                   │   operando en LAN)
                  ┌────────────────────┐    ┌────────────────────┐
                  │ ON-PREMISE (hotel) │    │ VPS (respaldo/admin)│
                  │ Docker compose     │    │ cyhotel-kiosco :8000│
                  │ - backend API      │    │ cyhotel-admin  :8001│
                  │ - Postgres + vol   │    │ cyhotel-master :8002│
                  │ - healthcheck      │    │ (respaldos offsite) │
                  └────────────────────┘    └────────────────────┘
```

- **Backend on-premise** es la fuente de verdad y funciona sin internet (la tablet apunta a la IP LAN).
- **VPS** queda para admin remoto y como destino de **respaldos offsite**.
- **UI híbrida**: el server primario da updates fáciles; si cae, el APK carga la UI empaquetada.
- **Cola offline** en el tablet: ningún check-in se pierde aunque el backend se caiga.

## Componentes

- `web/kiosco/` — **la app**. React + Vite + Tailwind + Framer Motion. PWA instalable.
  - API configurable (`VITE_API_BASE` / `?api=` en el shell) para funcionar servida **o** empaquetada.
  - Cola offline en `src/lib/offlineQueue.ts`.
- `backend/server.py` — API Python (`ThreadingHTTPServer`) que sirve el frontend y `/api/*`. Incluye `/api/health` para monitoreo.
- `android-shell/` — contenedor Android mínimo (WebView) en modo quiosco: fallback local automático, device-owner (single-app), arranque automático y watchdog.
- `web-master/` — panel maestro.

## Desarrollo

```bash
cd web/kiosco
npm install
npm run dev      # preview local http://localhost:5173
npm run build    # genera web/kiosco/dist
```

## Despliegue on-premise (producción 24/7)

1. En el equipo del hotel (Mini-PC/Raspberry siempre encendido) clonar el repo y levantar:
   ```bash
   cp .env.example .env && nano .env   # poner CYHOTEL_DB_PASSWORD
   docker compose up -d                # kiosco :8000, admin :8001, master :8002, db
   ```
2. Configurar respaldos y monitoreo en ese host:
   ```bash
   crontab -e
   # 0 3 * * * /home/CyHotel/scripts/backup.sh
   # */5 * * * * /home/CyHotel/scripts/monitor.sh
   ```
   (definir `CYHOTEL_OFFSITE` y `CYHOTEL_ALERT_WEBHOOK` en el entorno para copia offsite + alertas).
3. En la tablet: instalar el APK, abrir y, ante el prompt, ingresar `http://IP_LAN_DEL_HOTEL:8000/kiosco`.
   - La UI se sirve del server (update fácil). Si el server no responde en ~6s, el APK usa la UI local empaquetada.
   - Para **single-app fijo**: convertir la tablet en Device Owner (una vez) con:
     `adb shell dpm set-device-owner com.hoteldelvalle.kiosco/.AdminReceiver`
     (requiere limpiar cuenta de Google / factory reset previo). Luego la app se bloquea sola y arranca al encender.

## Respaldos y monitoreo

- `scripts/backup.sh` — `pg_dump` diario comprimido en `backups/`, retención configurable y copia **offsite** opcional (rsync a VPS/nube).
- `scripts/monitor.sh` — consulta `/api/health` cada 5 min y envía alerta por webhook si el kiosco cae (estado para no repetir).
- `docker-compose.yml` — `healthcheck` en `kiosco` y `db`, `restart: always` en todos los servicios.

## Actualizar el diseño (frontend)

El contenedor `kiosco` monta `./web` → `/app/web`, así que basta reconstruir el frontend en el host:

```bash
cd web/kiosco && npm run build
```

El server (bind mount) sirve la nueva versión al instante. Para cambios de lógica del backend, reconstruir la imagen:

```bash
docker compose up -d --no-deps --build kiosco
```

## Versión y release

- Versión en `web/kiosco/package.json` y `web/kiosco-version.json`.
- APK: `android-shell/app/build.gradle` (`versionName` / `versionCode`). El shell verifica actualizaciones contra el tag de GitHub.
- Publicar: `./scripts/release.sh 11.1.0 "mensaje"`. Esto crea el tag y sube el APK a la release de GitHub.
