# Contribuir — Hotel del Valle

## Flujo de trabajo

1.  Rama: `master` es producción. Crea rama feature `feat/nombre` o `fix/nombre`.
2.  Commits convencionales: `feat:`, `fix:`, `docs:`, `chore:`, `v1.2.x:` para releases.
3.  PR: describe cambio, screenshots si es UI, y `curl` de verificación.

## Versionado

Una sola versión para web + APK + backend:

| Archivo | Campo |
|---|---|
| `web/kiosco/package.json` | `version` |
| `web/kiosco-version.json` | `version` + `versionCode` (además `apk`, `minVersion`) |
| `android-shell/app/build.gradle` | `versionName` + `versionCode` (incremental) |
| `android-shell/app/src/main/java/com/hoteldelvalle/kiosco/MainActivity.kt` | `APP_VERSION` |

Bump atómico con `scripts/bump-version.sh <x.y.z>`: valida semver, falla si las 4 fuentes no están sincronizadas, sube `versionCode` +1, muestra el diff y deja el worktree listo SIN commitear ni tagear. El SW cache es `kiosco-v{version}`. `minVersion` es la versión mínima aceptada por OTA; el servidor calcula `sha256` en runtime (no va en el manifiesto).

## Build

```bash
# Frontend (bind mount → live)
cd web/kiosco && npm run build

# Backend (no es bind mount)
docker cp backend/server.py cyhotel-kiosco:/app/backend/server.py && docker restart cyhotel-kiosco
# o rebuild completo: docker compose up -d --build kiosco

# APK (requiere web/kiosco/dist actualizado)
cp -r web/kiosco/dist/* android-shell/app/src/main/assets/kiosco/
./gradlew assembleRelease  # o gradle wrapper dist 8.10.2
cp android-shell/app/build/outputs/apk/release/app-release.apk web/kiosco.apk
```

## Release

```bash
./scripts/release.sh 1.2.8 "mensaje"
# o manual: tag + GitHub release + upload Kiosko-v1.2.8.apk
```

El kiosco verifica update en `GET /api/kiosco-update` (local) y fallback GitHub `api.github.com/repos/.../releases/latest`. La tablet muestra "Buscar actualización" en el PIN admin.

## Estilo

- Frontend: Tailwind + tokens `docs/brand/DECISION.md` (blanco+verde, bronce solo precio). `Manrope` + `Cormorant Garamond`.
- Backend: stdlib `http.server`, `psycopg2`, RLS `cyhotel_app`. Ver `docs/ARCHITECTURE.md` ADRs.
- No commitear `dist/`, `*.apk` fuera de `web/kiosco.apk` (tracked), `keys/`, `.env`.

## Tests

Suite BASE (sin dependencias nuevas: `node:assert` + `unittest` stdlib, sin red/DB/docker):

```bash
# Frontend kiosco: semver OTA (parseVersion/isNewer/gte/shouldInstall)
cd web/kiosco && npm test

# Backend: pricing + validation + orders (stubs psycopg2, constantes reales de db.py)
python3 -m unittest discover -s backend/tests

# Higiene del diff (antes de PR)
git diff --check
```

Cobertura actual:

- `web/kiosco/tests/version.test.mjs`: compila `src/lib/version.ts` al vuelo con el esbuild local; cubre patch/minor/major, prefijo `v`, segmentos faltantes, orden numérico (`2.0.0 < 10.0.0`), `minVersion` que bloquea y downgrade dirigido permitido.
- `backend/tests/test_pricing_validation.py`: `pricing.apply_price_override` / `suite_subtotal`, `validation.validate_hotel_config` y `orders.validate_order_payload` / `build_order_times` (casos felices y de error, guard de dobles, constantes reales `ROOM_TYPES` / `AMANECIDA_*` / `HOLD_MINUTES`).

Regla: **todo PR con lógica nueva trae test**. Antes de PR, además: `cd web/kiosco && npm run build` debe pasar `tsc` sin errores; `curl http://localhost:8000/api/health` debe responder `200`. No tocar código fuente solo para hacer pasar un test: si un test revela un bug P0, repórtalo, no lo arregles en el mismo PR.
