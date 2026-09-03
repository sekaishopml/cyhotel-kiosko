#!/usr/bin/env bash
# release.sh — Publica una versión del Kiosco (app híbrida nativa + web) en GitHub.
# Uso: ./scripts/release.sh <x.y.z> ["mensaje"]   (ej. 1.3.1)
#
# Pasos:
#   1. Bump atómico verificado (scripts/bump-version.sh: package.json +
#      web/kiosco-version.json + MainActivity.kt APP_VERSION + build.gradle).
#   2. Build del frontend web (web/kiosco/dist).
#   3. Copia del dist dentro del APK (android-shell assets) para fallback offline.
#   4. Commit + tag + push (adds explícitos; falla si el tag ya existe).
#   5. Release en GitHub + subida del APK (el APK debe existir, si no falla).
#   6. Verificación final: diff dist vs assets + GET /api/kiosco-update.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?Uso: ./scripts/release.sh <x.y.z> [mensaje] (ej. 1.3.1)}"
MSG="${2:-Release Kiosko v$VERSION}"
REPO="sekaishopml/cyhotel-kiosko"
APP_DIR="$ROOT/web/kiosco"
ASSETS_DIR="$ROOT/android-shell/app/src/main/assets/kiosco"
CREDS="${HOME:-/home/opencode}/.git-credentials"
BASE_URL="${BASE_URL:-http://localhost:8000}"
# APK real (override: APK_SRC=/ruta/app.apk ./scripts/release.sh x.y.z).
# Orden: dist/HotelDelValle-Kiosko.apk → web/kiosco.apk (tracked, sirve /kiosco.apk)
#        → salida directa de Gradle → legacy dist/Kiosko-v$VERSION.apk.
APK_SRC="${APK_SRC:-}"
for cand in "$ROOT/dist/HotelDelValle-Kiosko.apk" "$ROOT/web/kiosco.apk" \
           "$ROOT/android-shell/app/build/outputs/apk/release/app-release.apk" \
           "$ROOT/dist/Kiosko-v$VERSION.apk"; do
  if [[ -z "$APK_SRC" && -f "$cand" ]]; then APK_SRC="$cand"; fi
done

[[ -f "$CREDS" ]] || { echo "ERROR: no existe ~/.git-credentials"; exit 1; }
TOKEN="$(sed -E 's#https://[^:]+:([^@]+)@(.+)#\1#' "$CREDS")"
[[ -n "$TOKEN" ]] || { echo "ERROR: token vacío"; exit 1; }

# Falla si el tag ya existe (nunca se reescribe un release publicado).
if git -C "$ROOT" rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
  echo "ERROR: el tag v$VERSION ya existe. Sube versión con scripts/bump-version.sh." >&2
  exit 1
fi

# --- bump atómico verificado (falla si las 4 fuentes están desincronizadas) ---
"$ROOT/scripts/bump-version.sh" "$VERSION"

# --- build frontend ---
cd "$APP_DIR"
npm run build
cd "$ROOT"

# --- empaquetar dist dentro del APK (fallback offline) ---
rm -rf "$ASSETS_DIR"
mkdir -p "$ASSETS_DIR"
cp -r "$APP_DIR/dist/." "$ASSETS_DIR/"
echo ">> dist copiado a assets del APK"

# --- el APK debe existir (construido según CONTRIBUTING.md); si no, falla ---
if [[ ! -f "${APK_SRC:-}" ]]; then
  echo "ERROR: no hay APK para v$VERSION. Construye según CONTRIBUTING.md y reintenta:" >&2
  echo "  cp -r web/kiosco/dist/* android-shell/app/src/main/assets/kiosco/" >&2
  echo "  ./gradlew assembleRelease && cp android-shell/app/build/outputs/apk/release/app-release.apk web/kiosco.apk" >&2
  echo "  (o deja el APK en dist/HotelDelValle-Kiosko.apk, o pasa APK_SRC=/ruta/app.apk)" >&2
  exit 1
fi
echo ">> APK: $APK_SRC"

# --- commit + tag + push (adds explícitos: nunca .env, logs/, backups/ ni dist/*.apk) ---
git -C "$ROOT" add -- web/kiosco/package.json web/kiosco-version.json web/kiosco.apk \
  android-shell/app/build.gradle \
  android-shell/app/src/main/java/com/hoteldelvalle/kiosco/MainActivity.kt \
  android-shell/app/src/main/assets/kiosco
git -C "$ROOT" -c user.name="sekaishopml" -c user.email="sekaishopml@users.noreply.github.com" \
  commit -q -m "release: Kiosko v$VERSION" || echo ">> sin cambios para commit"
git -C "$ROOT" tag "v$VERSION"
git -C "$ROOT" push -q origin master
git -C "$ROOT" push -q origin "v$VERSION"
echo ">> commit y tag v$VERSION subidos"

# --- release en GitHub (curl con chequeo de errores) ---
RESP="$(curl -sf -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases" \
  -d "{\"tag_name\":\"v$VERSION\",\"target_commitish\":\"master\",\"name\":\"Kiosko v$VERSION\",\"body\":\"$MSG\",\"draft\":false,\"prerelease\":false}")" \
  || { echo "ERROR: falló la creación del release v$VERSION en GitHub." >&2; exit 1; }
RELEASE_ID="$(echo "$RESP" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null || true)"
[[ -n "$RELEASE_ID" ]] || { echo "ERROR: GitHub no devolvió release id: $RESP" >&2; exit 1; }
echo ">> release: https://github.com/$REPO/releases/tag/v$VERSION (id=$RELEASE_ID)"

# --- subir APK ---
APK_NAME="Kiosko-v$VERSION.apk"
UP="$(curl -sf -X POST -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK_SRC" \
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=$APK_NAME")" \
  || { echo "ERROR: falló la subida del APK a la release v$VERSION." >&2; exit 1; }
echo ">> APK subido: $(echo "$UP" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('browser_download_url',''))" 2>/dev/null || echo OK)"

# --- verificación final: dist vs assets + endpoint local ---
if ! diff -r -q "$APP_DIR/dist" "$ASSETS_DIR" >/dev/null; then
  echo "ERROR: dist/ y assets del APK difieren. Rebuild + copia según CONTRIBUTING.md." >&2
  diff -r -q "$APP_DIR/dist" "$ASSETS_DIR" >&2 || true
  exit 1
fi
echo ">> verificado: dist/ == assets del APK"
if UPD="$(curl -sf "$BASE_URL/api/kiosco-update" 2>/dev/null)"; then
  UPD_V="$(echo "$UPD" | python3 -c "import sys,json;print(json.load(sys.stdin).get('version',''))" 2>/dev/null || true)"
  if [[ "$UPD_V" != "$VERSION" ]]; then
    echo "ERROR: /api/kiosco-update devuelve '$UPD_V', esperado '$VERSION'." >&2
    exit 1
  fi
  echo ">> verificado: /api/kiosco-update → $UPD_V"
else
  echo ">> AVISO: no se pudo consultar $BASE_URL/api/kiosco-update (¿servidor apagado?). Verifica a mano."
fi
echo ">> Listo."
