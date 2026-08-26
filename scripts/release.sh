#!/usr/bin/env bash
# release.sh — Publica una versión del Kiosco (app web) en GitHub.
# Uso: ./scripts/release.sh 11.0.0 ["mensaje"]
# El "app" es el frontend web (web/kiosco) servido por el backend y el android-shell WebView.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?Uso: ./scripts/release.sh <version> [mensaje] (ej. 11.0.0)}"
MSG="${2:-Release Kiosko v$VERSION}"
REPO="sekaishopml/cyhotel-kiosko"
APP_DIR="$ROOT/web/kiosco"
CREDS="${HOME:-/home/opencode}/.git-credentials"

[[ -f "$CREDS" ]] || { echo "ERROR: no existe ~/.git-credentials"; exit 1; }
TOKEN="$(sed -E 's#https://[^:]+:([^@]+)@(.+)#\1#' "$CREDS")"
[[ -n "$TOKEN" ]] || { echo "ERROR: token vacío"; exit 1; }

# --- bump version ---
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$APP_DIR/package.json"
printf '{"version":"%s"}\n' "$VERSION" > "$ROOT/web/kiosco-version.json"

# --- build frontend ---
cd "$APP_DIR"
npm run build
cd "$ROOT"

# --- commit + tag + push ---
git add -A
git -c user.name="sekaishopml" -c user.email="sekaishopml@users.noreply.github.com" commit -q -m "release: Kiosco v$VERSION" || echo ">> sin cambios para commit"
git tag -f "v$VERSION"
git push -q origin master
git push -q origin "v$VERSION"
echo ">> commit y tag v$VERSION subidos"

# --- release en GitHub ---
RESP="$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases" \
  -d "{\"tag_name\":\"v$VERSION\",\"target_commitish\":\"master\",\"name\":\"Kiosko v$VERSION\",\"body\":\"$MSG\",\"draft\":false,\"prerelease\":false}")"
echo ">> respuesta release: $(echo "$RESP" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('html_url') or d.get('message',''))")"
echo ">> Listo: https://github.com/$REPO/releases/tag/v$VERSION"
