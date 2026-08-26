# Hotel del Valle — Kiosco (App)

App de check-in táctil para tablet, pensada para personas mayores: tipografía grande y elegante, **sin scroll**, diseño fluido que se adapta a la pantalla (probado en tablet de 8").

## Arquitectura

- `web/kiosco/` — **la app**. Frontend React + Vite + Tailwind + Framer Motion. Es un PWA instalable (`public/manifest.webmanifest`).
- `backend/` — API Python (`ThreadingHTTPServer`) que sirve el frontend compilado en `web/kiosco/dist` y los endpoints `/api/*`.
- `android-shell/` — contenedor Android mínimo (WebView) que carga la app en modo kiosco (single-app). Es el "empaquetado" para la tablet.
- `web-master/` — frontend del panel maestro (otro servicio).

La app se sirve **directo desde el frontend web**: actualizar el diseño es solo reconstruir el frontend, sin APK.

## Desarrollo

```bash
cd web/kiosco
npm install
npm run dev      # preview local en http://localhost:5173
npm run build    # genera web/kiosco/dist
```

## Despliegue

El contenedor `kiosco` monta `./web` en `/app/web`, así que basta con reconstruir el frontend en el host:

```bash
cd web/kiosco && npm run build
```

Para reconstruir la imagen completa: `docker compose build kiosco && docker compose up -d kiosco`.

## Versión y release

La versión vive en `web/kiosco/package.json` y `web/kiosco-version.json`.
Para publicar: `./scripts/release.sh 11.0.0 "mensaje"`.

## Notas

Las apps nativas previas (React Native y Compose) fueron retiradas en v11.0; la app es ahora 100% web.
