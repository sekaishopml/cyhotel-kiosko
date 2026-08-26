#!/usr/bin/env bash
# release.sh — Publica una versión del Kiosco (app híbrida nativa + web) en GitHub.
# Uso: ./scripts/release.sh 11.1.0 ["mensaje"]
#
# Pasos:
#   1. Bump de versión (package.json + web/kiosco-version.json).
#   2. Build del frontend web (web/kiosco/dist).
#   3. Copia del dist dentro del APK (android-shell assets) para fallback offline.
#   4. Commit + tag + push.
#   5. Release en GitHub + subida del APK (si existe en dist/).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?Uso: ./scripts/release.sh <version> [mensaje] (ej. 11.1.0)}"
MSG="${2:-Release Kiosko v$VERSION}"
REPO="sekaishopml/cyhotel-kiosko"
APP_DIR="$ROOT/web/kiosco"
ASSETS_DIR="$ROOT/android-shell/app/src/main/assets/kiosco"
CREDS="${HOME:-/home/opencode}/.git-credentials"

[[ -f "$CREDS" ]] || { echo "ERROR: no existe ~/.git-credentials"; exit 1; }
TOKEN="$(sed -E 's#https://[^:]+:([^@]+)@(.+)#\1#' "$CREDS")"
[[ -n "$TOKEN" ]] || { echo "ERROR: token vacío"; exit 1; }

# --- bump version ---
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$APP_DIR/package.json"
printf '{"version":"%s","apk":"/kiosco.apk"}\n' "$VERSION" > "$ROOT/web/kiosco-version.json"

# --- build frontend ---
cd "$APP_DIR"
npm run build
cd "$ROOT"

# --- empaquetar dist dentro del APK (fallback offline) ---
rm -rf "$ASSETS_DIR"
mkdir -p "$ASSETS_DIR"
cp -r "$APP_DIR/dist/." "$ASSETS_DIR/"
echo ">> dist copiado a assets del APK"

# --- commit + tag + push ---
git add -A
git -c user.name="sekaishopml" -c user.email="sekaishopml@users.noreply.github.com" \
  commit -q -m "release: Kiosko v$VERSION" || echo ">> sin cambios para commit"
git tag -f "v$VERSION"
git push -q origin master
git push -q origin "v$VERSION"
echo ">> commit y tag v$VERSION subidos"

# --- release en GitHub ---
RESP="$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases" \
  -d "{\"tag_name\":\"v$VERSION\",\"target_commitish\":\"master\",\"name\":\"Kiosko v$VERSION\",\"body\":\"$MSG\",\"draft\":false,\"prerelease\":false}")"
RELEASE_ID="$(echo "$RESP" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null || true)"
echo ">> release: https://github.com/$REPO/releases/tag/v$VERSION (id=$RELEASE_ID)"

# --- subir APK si existe ---
APK="$ROOT/dist/Kiosko-v$VERSION.apk"
if [[ -f "$APK" ]]; then
  UP="$(curl -s -X POST -H "Authorization: token $TOKEN" \
    -H "Content-Type: application/vnd.android.package-archive" \
    --data-binary @"$APK" \
    "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=$(basename "$APK")")"
  echo ">> APK subido: $(echo "$UP" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('browser_download_url',''))" 2>/dev/null || echo OK)"
else
  echo ">> APK no encontrado en $APK (omitiendo subida)"
fi
echo ">> Listo."
