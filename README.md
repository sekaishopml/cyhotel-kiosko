# Hotel del Valle — Kiosco (App híbrida nativa + web)

App de check-in táctil para tablet, pensada para personas mayores: tipografía grande y elegante, **sin scroll**, diseño fluido que se adapta a la pantalla (probado en tablet de 8").

Es una **app híbrida**: un `android-shell` nativo (WebView, modo quiosco) que muestra el frontend React. La interfaz es 100% web y, además, viene **empaquetada dentro del APK** como respaldo offline.

## Documentación

| Doc | Para qué |
|---|---|
| `docs/ARCHITECTURE.md` | Arquitectura C4, componentes, BD, ADRs |
| `docs/api_contract_v2.md` | Contrato API v2 (tabla de endpoints) |
| `backend/openapi.yaml` | Spec OpenAPI (fuente para Redoc) |
| `docs/brand/01_estrategia_marca.md` | Posicionamiento Anfitrión/Refugio |
| `docs/brand/02_identidad_visual.md` | Propuesta visual histórica |
| `docs/brand/03_brand_kit.md` | Brand kit APROBADO (blanco+verde) |
| `docs/brand/DECISION.md` | **Decisión vigente** que zanja 02 vs 03 (70/20/10) |
| `README-INFRA.md` | Deploy, backups, auditoría SQL, LISTEN/NOTIFY |
| `CONTRIBUTING.md` | Cómo contribuir, versionado, releases |
| `AGENTS.md` | Guía para asistentes IA |

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

- `web/kiosco/` — **la app kiosco.** React 18 + Vite 5 + Tailwind 3 + PWA. Ver `web/kiosco/src/*`.
- `backend/server.py` — API Python (`ThreadingHTTPServer`) que sirve el frontend y `/api/*`. Incluye `/api/health` para monitoreo. Esquema en `backend/db.py`.
- `android-shell/` — contenedor Android (WebView) en modo quiosco: fallback local automático, device-owner (single-app), arranque automático y watchdog.
- `web/admin.html` + `web-master/master.html` — paneles vanilla (migración gradual a React en Fase 4).
- `web/kiosco-version.json` — versión OTA servida en `/api/kiosco-update`.

## Desarrollo

```bash
cd web/kiosco
npm install
npm run dev      # preview local http://localhost:5173
npm run build    # genera web/kiosco/dist (bind mount → live al instante)
```

Backend (requiere `DATABASE_URL` o Postgres local):
```bash
python3 backend/server.py  # 0.0.0.0:8000, APP_MODE=kiosco por defecto
```

Ver `CONTRIBUTING.md` para versionado y releases.

## Despliegue on-premise (producción 24/7)

1. En el equipo del hotel (Mini-PC siempre encendido):
   ```bash
   cp .env.example .env && nano .env   # CYHOTEL_DB_PASSWORD
   docker compose up -d                # kiosco :8000, admin :8001, master :8002, db
   ```
2. Respaldos y monitoreo en ese host:
   ```bash
   crontab -e
   # 0 3 * * * /home/CyHotel/scripts/backup.sh
   # */5 * * * * /home/CyHotel/scripts/monitor.sh
   ```
   Definir `CYHOTEL_OFFSITE` y `CYHOTEL_ALERT_WEBHOOK` para copia offsite + alertas. Detalles en `README-INFRA.md`.
3. En la tablet: instalar el APK, abrir y ante el prompt ingresar `http://IP_LAN_DEL_HOTEL:8000/kiosco`.
   - La UI se sirve del server (update fácil). Si el server no responde en ~6s, el APK usa la UI local empaquetada.
   - Para **single-app fijo**: `adb shell dpm set-device-owner com.hoteldelvalle.kiosco/.AdminReceiver` (requiere factory reset previo).

## Actualizar el diseño (frontend)

El contenedor `kiosco` monta `./web:/app/web`, así que basta reconstruir el frontend en el host:

```bash
cd web/kiosco && npm run build
```

Para cambios de backend: `docker compose up -d --no-deps --build kiosco` (backend no es bind mount).

## Marca

La identidad vigente es **blanco + verde** (`docs/brand/DECISION.md` 70/20/10) con tagline **"Descanso elegante, trato de casa."** Ver `docs/brand/01_estrategia_marca.md`.

## Licencia

Privado — Hotel del Valle.
