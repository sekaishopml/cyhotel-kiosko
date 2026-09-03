---
title: Seguridad P0 diferida (dev backend/diseño)
status: accepted
date: 2026-09-03
---

# ADR-007: Seguridad P0 diferida durante dev backend/diseño

## Contexto

Auditoría 2026-09-03 detectó riesgos P0. El equipo está en fase dev backend + diseño P1, no en hardening de seguridad. No se aplican fixes de seguridad en esta fase para no bloquear el flujo de diseño.

## Decisión

Diferir P0 a fase posterior. Queda documentado como backlog obligatorio antes de producción ampliada. No se considera "resuelto".

## Backlog P0 (no implementar en P1)

### Críticos

1. **PIN `12345` hardcodeado**
   - `web/kiosco/src/App.tsx:12`
   - `android-shell/app/src/main/java/com/hoteldelvalle/kiosco/MainActivity.kt:64`
   - `backend/server.py:741` (`CYHOTEL_ADMIN_PIN` default `12345`)
   - Acción futura: PIN por instalación, secreto provisionado, rate-limit + bloqueo temporal, no permitir endpoint arbitrario sin validación.

2. **HTTP en claro + cleartext**
   - `docker-compose.yml:38-90` (8000/8001/8002 directos)
   - `android-shell/app/src/main/AndroidManifest.xml:11` (`usesCleartextTraffic=true`)
   - `README-INFRA.md:143-148` (HTTPS pendiente)
   - Acción futura: reverse proxy TLS, restringir admin/master a VPN/LAN/allowlist.

3. **URL servidor sin validación**
   - `web/kiosco/src/App.tsx:154-159`
   - `android-shell/.../MainActivity.kt:483-506`
   - Acción futura: solo HTTPS o hosts/IP autorizados + confirmación.

4. **OTA APK sin verificación**
   - `android-shell/.../MainActivity.kt:703-899`
   - `backend/server.py:3075` (`download_url` desde `Host`)
   - Acción futura: hash firmado / firma cert + canal autenticado, no confiar en `Host`.

### Altos

5. **RLS docs contradictorias**
   - Código ya usa `cyhotel_app` en `docker-compose.yml:35,65,86` + `backend/db.py:16-20,365-406`.
   - Docs aún dicen "pendiente": `docs/ARCHITECTURE.md:138-152,212`, `docs/rls-fix.patch`.
   - Acción futura: verificar rol efectivo en runtime, archivar patch, actualizar ADR-003.

6. **Token en query SSE**
   - `backend/server.py:404-415`, `web/admin.html:4030-4041`
   - Acción futura: cookie HttpOnly segura o auth específico SSE, evitar logging.

7. **Seeds con defaults conocidos**
   - `backend/db.py:100-107`
   - Acción futura: fallar arranque prod sin env + rotación inicial obligatoria.

8. **`POST /api/kiosco-crash` público sin límites**
   - `backend/server.py:669-670,3107-3116`, `server.py:326-334` (sin límite `Content-Length`)
   - Acción futura: límite body, validación esquema, rate-limit IP/dispositivo, log rotado.

9. **Errores internos expuestos (`str(e)`)**
   - `backend/server.py:561-564,674-685`
   - Acción futura: correlation ID + mensaje genérico prod.

10. **Android `mixedContentMode=ALWAYS_ALLOW`**
    - `MainActivity.kt:281`
    - Acción futura: `MIXED_CONTENT_NEVER_ALLOW` + excepción LAN explícita temporal.

11. **Hash PBKDF2 con salt determinista**
    - `backend/db.py:440-460`
    - Acción futura: migración gradual Argon2id/bcrypt + verificación compatible.

12. **Firma/keys en árbol trabajo**
    - `keys/kiosko-release.jks` + `keystore.properties` (gitignore ok, riesgo operativo)
    - `android-shell/app/build.gradle:18-29` (ruta absoluta)
    - Acción futura: secret manager / archivo externo + validar backups cifrados.

## Criterios de cierre P0 (fase seguridad)

- [ ] PIN fuera del bundle + rate-limit verificado
- [ ] HTTPS activo + admin/master restringidos
- [ ] URL validada + OTA verificada (hash/firma)
- [ ] Seeds sin defaults + arranque falla sin env prod
- [ ] Límites body/rate-limit + errores genéricos + correlation ID
- [ ] Docs RLS actualizadas + patch archivado
- [ ] Tests RLS/auth/pagos/idempotencia en verde

## Consecuencias

- P1 no toca estos puntos salvo documentación.
- Cualquier nuevo código no debe empeorarlos (no nuevos secretos hardcodeados, no nuevos endpoints públicos sin auth).
- Este ADR es la fuente de verdad del diferimiento.
