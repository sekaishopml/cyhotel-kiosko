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
| `web/kiosco-version.json` | `version` |
| `android-shell/app/build.gradle` | `versionName` + `versionCode` (incremental) |
| `android-shell/app/src/main/java/com/hoteldelvalle/kiosco/MainActivity.kt` | `APP_VERSION` |

Bump manual antes de release. El SW cache es `kiosco-v{version}`.

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

Aún sin suite. Antes de PR: `cd web/kiosco && npm run build` debe pasar `tsc` sin errores; `curl http://localhost:8000/api/health` debe responder `200`.
