# Guía para Agentes IA — Hotel del Valle

Este repo usa asistentes (OpenCode / Muse Spark). Reglas para no romper producción 24/7.

## Principios de ingeniería

- Arquitectura: monolito modular, multi-tenant con PostgreSQL/RLS y contratos OpenAPI.
- Mantener separadas las responsabilidades de rutas, servicios, persistencia y UI.
- No introducir microservicios, dependencias o abstracciones nuevas sin una razón operacional documentada.
- No duplicar reglas de negocio: precios, validaciones y transiciones deben tener una única fuente.
- Todo endpoint o servicio público nuevo requiere pruebas automatizadas.
- Todo cambio de esquema requiere migración, verificación de rollback y actualización de documentación.
- No romper `docs/api_contract_v2.md` ni `backend/openapi.yaml` sin un ADR y plan de compatibilidad.
- Mantenibilidad y claridad tienen prioridad sobre soluciones ingeniosas.
- No dejar TODOs sin una referencia a issue o tarea concreta.

## Flujo obligatorio de trabajo

1. Entender la arquitectura, contratos, estado de Git y pruebas existentes.
2. Crear un plan que identifique archivos afectados, riesgos y posibles breaking changes.
3. Implementar el cambio mínimo seguro, sin cambiar la arquitectura sin justificarlo.
4. Añadir o actualizar pruebas.
5. Ejecutar lint, tests y las verificaciones operativas pertinentes.
6. Hacer una revisión independiente de bugs, seguridad, concurrencia y regresiones.
7. Actualizar ADR, OpenAPI o documentación cuando cambie el comportamiento.
8. Revisar el diff antes de preparar un commit.

## Enrutamiento de modelos OpenCode

- Luna: arquitectura, implementación transversal, refactor, UI, Android y debugging normal.
- DeepSeek Pro: revisión senior, seguridad y razonamiento complejo, sin editar durante la revisión.
- DeepSeek Flash/Qwen Flash: documentación, tests sencillos y mantenimiento repetitivo.
- Confirmar siempre el `provider/model` disponible antes de fijar un modelo alternativo en configuración.

## Stack en 30s

- **Backend:** `backend/server.py` (ThreadingHTTPServer stdlib, no Flask) + `backend/db.py` (PG 16, RLS). Un Dockerfile, 3 `APP_MODE` (kiosco/admin/master) vía `docker-compose.yml`.
- **Frontend kiosco:** `web/kiosco` (React 18 + Vite + Tailwind, PWA). Admin/master son `web/admin.html` y `web-master/master.html` vanilla.
- **Android:** `android-shell/` (WebView kiosk, OTA vía `MainActivity.kt`).

## Reglas de oro

1.  **No uses `docker cp` para `web/kiosco/dist`** — es bind mount (`./web:/app/web`). Solo `npm run build` y verifica con `curl`.
2.  **Backend no es bind mount** — sí requiere `docker cp` + `docker restart` o `compose up --build`.
3.  **Versionado atómico:** bump `package.json` + `web/kiosco-version.json` + `MainActivity.kt APP_VERSION` + `build.gradle versionCode/Name` juntos con `scripts/bump-version.sh <x.y.z>` (sube `versionCode` +1, no commitea ni tagea).
4.  **Paleta vigente:** `docs/brand/DECISION.md` (70/20/10 blanco+verde+bronce). No reintroducir `navy #0F172A`/`gold #D4AF37` sin ADR.
5.  **Idioma del usuario:** español. Respuestas concisas, con `file:line` refs.
6.  **Verifica con `curl` tras cada build:** `curl -s http://68.168.20.219:8000/kiosco/ | grep index-` y `curl -s /api/kiosco-update`.
7.  **No commitear secretos:** `keys/`, `.env`, `*.jks` están en `.gitignore`.

## Dónde mirar

- Arquitectura: `docs/ARCHITECTURE.md` (C4 + ADRs)
- Contrato API: `docs/api_contract_v2.md` + `backend/openapi.yaml`
- Marca: `docs/brand/01_estrategia_marca.md`, `03_brand_kit.md`, `DECISION.md`
- Infra: `README-INFRA.md` (auditoría SQL, LISTEN/NOTIFY)

## Comandos útiles

```bash
cd web/kiosco && npm run build
curl -s http://68.168.20.219:8000/kiosco/sw.js | grep kiosco-v
docker compose logs -f --tail=100 admin
```

## Flujo de release

Ver `CONTRIBUTING.md` y `scripts/release.sh`.
