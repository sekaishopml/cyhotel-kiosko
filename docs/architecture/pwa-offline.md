# PWA offline — Kiosco (P1d perf/offline seguro + P2 unificación)

> Alcance P1d: endurecer sin romper. No toca seguridad (PIN/HTTPS/OTA), backend,
> Android, colores, layout ni precios. No edita `RoomCard`/`IdleScreen`/`CheckinForm`.
>
> P2 (implementado, ver §§4-5): unificación `api-client` en
> `packages/shared`, cola en IndexedDB con fallback, variantes WebP con
> `<picture>` en `RoomCard`/`IdleScreen` (mismas clases Tailwind, sin cambios
> de estilos/colores/layout), eliminación de `web/sw.js`. Sin tocar backend
> (solo se añadieron estáticos `*.webp` en `web/hotel-imagenes/`, que
> `_serve_img` ya servía como `image/webp`), Android, seguridad, navegación/
> store de `App.tsx`, lógica de `CheckinScreen` ni tests existentes.

## 1. Estado actual: un solo SW vigente

Fuente de verdad del SW: `web/kiosco/scripts/build-sw.mjs:37-110` (plantilla) →
generado a `web/kiosco/dist/sw.js` en cada `npm run build`
(`web/kiosco/package.json:8`). `CACHE_NAME = kiosco-v<package.json version>`
(`build-sw.mjs:35`), precache = `./`, `./index.html`, JS/CSS/woff2 del
`index.html`, `manifest.webmanifest`, `icon.svg` + estáticos
(jpg/png/webp/svg/ico/woff2) bajo `dist/` (`build-sw.mjs:20-33`).

| Archivo | Rol | Estado |
|---|---|---|
| `web/kiosco/scripts/build-sw.mjs` | **Único generador vigente** | Fuente de verdad |
| `web/kiosco/dist/sw.js` | SW en producción (servido como `/kiosco/sw.js`) | Regenerado por build |
| `android-shell/app/src/main/assets/kiosco/sw.js` | Copia embebida para fallback `file:///android_asset` del APK | Sincronizar tras bump de versión (proceso Android, fuera de P1d) |
| `web/sw.js` | **Eliminado en P2** | Estrategia ingenua (network-then-cache de TODO incl. API, precache solo `/kiosco/`, sin versionado). Sin referencias fuera de este doc (verificado con grep en P2) |

Registro: `web/kiosco/src/main.tsx:7-11` — `register('/kiosco/sw.js',
{ scope: '/kiosco/' })`. El scope explícito es idéntico al scope por defecto
del script: no cambia lógica, solo lo documenta. El `.catch(() => {})` cubre
`vite dev` (404 del SW) sin romper arranque.

## 2. Estrategia de caché (vigente, generada por `build-sw.mjs:56-109`)

- **API → NetworkOnly.** Doble guarda (`build-sw.mjs:62`): `url.pathname`
  empieza con `/api` **o** `url.href` incluye `/api/` (cubre `API_BASE`
  cross-origin/LAN por IP). Ninguna respuesta `/api/*` se lee ni escribe en
  caché: evita stale + datos sensibles cacheados. Decisión intencional, no cambiar.
- **Navigations (document) → NetworkFirst → caché → fallback offline**
  (`build-sw.mjs:68-82`). Solo cachea responses `ok`; fallback a caché y luego
  `./index.html` / `/kiosco/index.html` (shell offline).
- **Assets (js/css/img/font/svg) → CacheFirst → red → `cache.put`**
  (`build-sw.mjs:89-108`). Solo cachea `response.ok` con `type basic`/`cors`;
  nunca opacas ni errores (no envenena caché). `/img/*` y uploads de
  habitaciones **sí** se cachean: imagen stale offline > hueco; el backend
  versiona imágenes por URL.
- **Limpieza:** en `activate` se borra todo caché cuyo nombre ≠ `CACHE_NAME`
  actual (`build-sw.mjs:47-54`).

## 3. Cola offline (P1d — `web/kiosco/src/api.ts:151-216`)

Endurecida sin cambiar firmas (`enqueueOrder(payload): void`,
`syncPending(): Promise<void>` — usadas en `screens/CheckinScreen.tsx:36` y
`App.tsx:32`):

- `readQueue()` defensivo: `try/catch` en `getItem` + `JSON.parse`, valida
  `Array.isArray`, filtra no-objetos. Cola corrupta → `[]`, nunca rompe check-in.
- Cap `QUEUE_CAP = 50` con FIFO drop oldest (`while shift` al encolar + `slice`
  en el path de quota).
- TTL `QUEUE_TTL_MS = 24h`: se descartan expirados al encolar y al sincronizar
  (y se persiste el descarte aunque no haya nada que enviar).
- `writeQueue()` best-effort: ante `QuotaExceeded`, un reintento con los últimos
  50; nunca lanza.
- `syncPending` conserva `stop-on-first-failure` (preserva orden).
- **No migrado a IndexedDB** (límite ~5MB localStorage aceptado en P1d; ver §5).
- `retryFetch` **sin cambios de lógica** en P1d; solo comentario
  `TODO(P2-unify-api-client)` en `api.ts:37-42`.

## 4. Imágenes WebP (P2 — implementado)

Estado P1d (solo documentado) → aplicado en P2 sin cambiar clases Tailwind
ni layout (`<picture class="contents">` no genera caja: el `<img>` sigue
siendo el ítem flex/absoluto de antes):

- Variantes generadas (PIL `Image.save WEBP`, q80 full / q75 thumb — en este
  entorno no existen `cwebp` ni `ffmpeg`; sin nuevas dependencias):
  `habitacion.webp` (899×1599, ~44KB), `suite.webp` (720×1600, ~25KB),
  `habitacion-thumb.webp` (400×711, ~12KB), `suite-thumb.webp` (400×889,
  ~9KB) — antes solo JPEG (~80KB + ~43KB).
  Comando reproducible:
  `python3 -c "from PIL import Image; ..."` (ver historial P2; regenera los
  8 ficheros desde los JPEG homónimos).
- Copias en dos orígenes (mismos bytes, md5 idénticos):
  - `web/kiosco/public/img/` → empaquetado en `dist/img/` y precacheado por
    el SW (el regex de `build-sw.mjs:20` ya incluía `webp`; verificado en
    `dist/sw.js` tras `npm run build`). Lo usa el hero de `IdleScreen`
    (rutas relativas `img/*.webp`).
  - `web/hotel-imagenes/` → servido por backend en `/img/<nombre>` por
    basename (`_serve_img`, sin cambios de código: ya mapeaba `.webp` →
    `image/webp`). Lo usa `RoomCard` vía `imgUrl()` (mismo patrón de URL con
    extensión `.webp` / sufijo `-thumb.webp`).
- Servido con `<picture><source type="image/webp"><img …></picture>`:
  - `components/RoomCard.tsx` — thumb usa `-thumb.webp`, galería el `.webp`
    full; `width`/`height` intrínsecos, `decoding="async"`, `loading="lazy"`
    en ambos (el thumb ya era lazy). Guarda `onError`: si el backend aún no
    tiene los `*.webp` desplegados, quita el `<source>` y cae a JPEG (sin
    imagen rota; verificado en tests manuales de QA §6).
  - `screens/IdleScreen.tsx` — hero/fondo con `.webp` full, `width`/`height`
    intrínsecos, `decoding="async"`, `fetchpriority="high"` **solo aquí**
    (único hero); sin `loading="lazy"` (eager por defecto).
- Paso 5 del plan original (negociación `Accept: image/avif` en `/img/*`)
  sigue fuera de alcance (requeriría cambio de backend).

> Nota histórica P1d (superada): antes solo existían los JPEG; `RoomCard`
> thumb sin `width`/`height`/`decoding`/`fetchpriority`, galería sin
> lazy/decoding; `IdleScreen` fondo sin `fetchpriority`/`decoding`/
> dimensiones; `imgUrl()` siempre JPEG. AVIF no se genera (sin encoder en el
> entorno; WebP cubre el ahorro principal: ~45% menos bytes).

## 5. Unificación `packages/shared/src/api-client.ts` ↔ `web/kiosco/src/api.ts` (P2 — implementado)

Resultado (tabla de decisiones aplicada):

| Tema | Decisión P2 | Estado |
|---|---|---|
| `retryFetch` 4xx | Adoptar shared (sin reintentos inútiles en POST) | ✅ `api-client.ts: retryFetch` no reintenta 4xx **salvo 408/429** (estos sí, como 5xx/red); `TODO(P2-unify-api-client)` eliminado de `api.ts` |
| `enqueueOrder` firma | `(payload: OrderPayload): void` con `OrderPayload` en shared | ✅ canónica en `queue-store.ts`; `api.ts` adapta y **mantiene `→boolean`** (compat `CheckinScreen`) |
| `syncPending` firma | Inyección `createOrder` (testeable, admin/master) | ✅ `syncPending(createOrder, opts?)` en shared; `api.ts: syncPending()` sin args la invoca con el interno → **`App.tsx:32` sin cambios** (desvío documentado del plan, que pedía editarlo) |
| `JSON.parse` cola | Portar `readQueue`/`writeQueue` defensivos a shared | ✅ en `queue-store.ts` (+ `isQueuedOrder`, `isExpired`, `StorageLike` inyectable para tests) |
| Cachés `getTypes`/config TTL | Kiosco-only | ✅ documentado como kiosco-only (usan `DEFAULT_CONFIG` del kiosco); no se mueven |
| `API_BASE`/`resolveApiBase` | Única fuente en shared | ✅ `api.ts` re-exporta (`API_BASE`, `ApiError`, `fetchWithTimeout`, `imgUrl`, `retryFetch`); tipos vía `types.ts` (re-export) |

Tests: `web/kiosco/tests/offline-queue.test.mjs` (25 casos, estilo
`node:assert` + esbuild como `version.test.mjs`; corre en `npm test`):
cap 50 FIFO, TTL 24h, cola corrupta, dead-letter 4xx (408/429 reintentan),
stop-on-first-failure, `enqueueOrder→boolean` incl. quota-false, y
`syncPending()` del adaptador vía `fetch` stub.

### 5.1 Cola en IndexedDB con fallback (P2 — implementado)

Diseño (`packages/shared/src/queue-store.ts`, sin librerías — API
IndexedDB por callbacks, compatible WebView Android 8):

- Un solo registro `offline_queue` en object-store `kv` de la DB
  `cyhotel-kiosco` (sin cursores/índices: `get`/`put` atómicos).
- `saveQueue()`: escribe localStorage (síncrono, rápido) + IndexedDB
  (durable); vale con que persista uno. `loadQueue()`: lee ambos y
  **fusiona por `client_ref`** (gana `queuedAt` mayor, orden FIFO, cap 50),
  curando divergencias (espejo async pendiente, múltiples tabs).
- Path síncrono `enqueueOrder→boolean` (CheckinScreen no puede esperar):
  escribe localStorage + `mirrorQueueToIdb()` fire-and-forget; la
  verificación de persistencia se mantiene sobre localStorage.
- Fallback total: sin IndexedDB (privado, WebView vieja, error, `blocked`)
  todo sigue en localStorage — **nunca se cuelga ni lanza** (`openDb`
  resuelve `null` ante cualquier fallo).
- Misma semántica P1d preservada: cap 50 FIFO, TTL 24h, dead-letter 4xx
  salvo 408/429, poda de expirados persistida.
- Primera ejecución tras P2: si IndexedDB está vacío y localStorage tiene
  datos, se siembra IndexedDB desde localStorage (migración automática).

## 6. Checklist QA offline / reconexión / fallback APK

Offline (DevTools → Network: Offline, o `adb` + modo avión en tablet):

- [ ] Con red y SW activo, abrir `/kiosco/` → `Application > Cache Storage`
      contiene `kiosco-v<version>` con `./`, `index.html`, assets e imgs.
- [ ] Sin red, recargar `/kiosco/` → shell servido desde caché (fallback
      `index.html`), sin pantalla en blanco.
- [ ] Sin red, `/api/*` nunca se sirve de caché (falla limpio, sin datos stale).
- [ ] Sin red, completar check-in → pedido en `kiosko_offline_queue`
      (`Application > Local Storage`), app sigue operable.
- [ ] Cola corrupta (`localStorage kiosko_offline_queue = "%%%"`) → check-in no
      rompe; al re-encolar la cola se regenera.
- [ ] Cola > 50 ítems → solo se conservan los 50 más recientes (FIFO).
- [ ] Ítem con `queuedAt` > 24h → descartado en próximo `enqueue`/`sync`.
- [ ] Reconexión → `syncPending` (poll en `App.tsx:32`) envía en orden y vacía
      la cola; fallo a mitad → conserva orden restante.
- [ ] Dead-letter: pedido rechazado con 4xx (p. ej. validación) se descarta
      sin bloquear los siguientes; 408/429 sí reintentan (cubierto en
      `tests/offline-queue.test.mjs`, verificar una vez en tablet).
- [ ] IndexedDB: con red caída, encolar → `DevTools > Application >
      IndexedDB > cyhotel-kiosco > kv > offline_queue` contiene el pedido;
      con IndexedDB borrado/vetado la app sigue operando (fallback LS).
- [ ] Imágenes: `dist/img/*.webp` existen y `dist/sw.js` los precachea;
      en tablet 8" comparar visualmente hero `IdleScreen` y `RoomCard`
      (WebP vs JPEG; QA visual pendiente en dispositivo).
- [x] Tras `npm run build` con bump de versión → `dist/sw.js` con nuevo
      `CACHE_NAME`, activación purga cachés viejos (sin assets huérfanos).
- [x] Legacy `web/sw.js` eliminado en P2 (cero referencias fuera de este doc).
- [ ] Fallback APK: WebView sin LAN carga `file:///android_asset/kiosco`,
      opera offline y reintenta contra LAN al volver (verificación en dispositivo,
      fuera de P1d — proceso Android).

## 7. No-goals P1d (explícitos) — actualización P2

Seguridad (PIN/HTTPS/OTA), backend (código; solo se añadieron estáticos
`*.webp`, ya servidos), Android (`MainActivity`, `build.gradle`, assets
APK), colores/estilos/layout/precios, lógica de `CheckinForm`, negociación
`Accept: image/avif` en `/img/*`.

Lo que P2 **sí** completó de la lista original de no-goals: migración
IndexedDB (§5.1), cambio de lógica de reintentos (4xx sin retry salvo
408/429), eliminación de `web/sw.js` (§1), y `<picture>`/atributos en
`RoomCard`/`IdleScreen` (§4, sin tocar estilos ni layout).

## 8. Fase 4-parcial: sin TanStack Query (decisión explícita)

El kiosco solo tiene 3 lecturas (`getTypes` con caché TTL 60s, `getKioscoConfig`
con fallback a `DEFAULT_CONFIG`, `checkVersion` puntual) + `createOrder` al
enviar: `fetch` manual + `retryFetch` compartido + cachés locales ya cubren
reintentos, TTL y offline sin añadir ~12KB ni una capa de invalidación que no
se usa. Se re-evalúa solo si las queries crecen o aparece estado servidor
compartido entre pantallas.
