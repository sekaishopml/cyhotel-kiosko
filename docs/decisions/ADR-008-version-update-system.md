---
title: Sistema de actualización de versiones (OTA verificable)
status: accepted
date: 2026-09-03
---

# ADR-008: Sistema de actualización de versiones (OTA verificable)

## Contexto

La auditoría 2026-09-03 encontró: versionado en 4 fuentes sincronizado solo a
mano (`package.json`, `kiosco-version.json`, `MainActivity.APP_VERSION`,
`build.gradle`), `dist/` y `assets/` del APK divergentes con el mismo
`CACHE_NAME`, tags solo hasta `v1.2.2` con archivos ya en 1.3.0, `release.sh`
destructivo (`rm -rf`, `git add -A`, `tag -f`), OTA sin verificación
(`http://{Host}/kiosco.apk`, sin checksum), comparación web por desigualdad y
botón "instalar" sin acción. Ver `docs/decisions/ADR-007-seguridad-diferida.md`
(P0 OTA diferido entonces, ahora implementado salvo HTTPS global).

## Decisión

1. **Fuente de versión:** `web/kiosco-version.json` es el manifiesto
   `{version, versionCode, apk, minVersion}`. `sha256`/`size` los calcula el
   servidor en runtime desde `web/kiosco.apk` (cache por mtime).
2. **Bump atómico:** `scripts/bump-version.sh <x.y.z>` (valida semver, exige
   sincronía previa, +1 `versionCode`, sin commit/tag). `release.sh` lo usa,
   con adds explícitos, sin `tag -f`, `curl -sf`, APK obligatorio y
   verificación `diff dist vs assets` + `curl /api/kiosco-update`.
3. **Contrato OTA** `GET /api/kiosco-update` →
   `{version, versionCode, minVersion, apk, download_url, sha256, size,
   apkAvailable}`. `download_url` respeta `X-Forwarded-Proto`. Sin manifiesto
   o sin versión, `/api/kiosco-version` responde 503 (no 200 silencioso).
4. **Android:** `UpdateManager.kt` único (MainActivity delega). Verifica
   SHA-256 + tamaño antes de instalar; GitHub CONSERVADO pero pineado
   (https, repo fijo, tag `^v\d+\.\d+\.\d+$`, asset exacto
   `Kiosko-<tag>.apk`); política `remote != local && remote >= minVersion`
   (downgrade dirigido permitido, antiguas bloqueadas); instalación manual
   con diálogo + auto-silenciosa vía `PackageInstaller` si device-owner en
   ventana 02:00–04:00; bridge `downloadUpdate(url, tag, sha256, size)`.
5. **Web:** semver compartido (`lib/version.ts`), botón admin dispara la
   descarga nativa real, banner "Nueva vista disponible" vía evento
   `kiosco:sw-updated` + poll 5 min (cubre shell stale con `skipWaiting`).
6. **Cola offline:** errores con `status` (`ApiError`), `enqueueOrder`
   retorna persistencia verificada, dead-letter en 4xx definitivos
   (408/429 reintentan), validación de forma en `readQueue`, aviso honesto
   si el pedido no pudo guardarse (nunca falso "Pendiente").

## Consecuencias

- Todo release futuro pasa por bump + `diff` + `curl`; el drift `dist` vs
  `assets` queda cerrado (sincronizado en 1.3.0).
- Downgrade solo hasta `minVersion`; subir `minVersion` bloquea versiones
  viejas sin canal nuevo.
- Pendiente (fuera de alcance): HTTPS global + restricción admin/master
  (ADR-007), `Range`/resume en APK, `PackageInstaller` verificado en
  dispositivo (sin SDK en este entorno: compilar con
  `./gradlew :app:assembleRelease` + probar matriz OTA en tablet física).
