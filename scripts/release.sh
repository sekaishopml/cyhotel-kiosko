#!/usr/bin/env bash
# release.sh — Compila, firma y publica una versión de la app Kiosko en GitHub.
# Uso: ./scripts/release.sh 1.1.0 [mensaje]
# Requiere: Gradle cache, SDK en /opt/android-sdk, credenciales de GitHub en ~/.git-credentials
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?Uso: ./scripts/release.sh <version> [mensaje] (ej. 1.1.0)}"
MSG="${2:-Release Kiosko v${VERSION}}"

# --- vars ---
GRADLE_BIN="${GRADLE_BIN:-/home/opencode/.gradle/wrapper/dists/gradle-8.10.2-bin/a04bxjujx95o3nb99gddekhwo/gradle-8.10.2/bin/gradle}"
JAVA_HOME_DEF="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
REPO="sekaishopml/cyhotel-kiosko"
APP_DIR="$ROOT/android-kiosco"
DIST="$ROOT/dist/HotelDelValle-Kiosko.apk"
CREDS="${HOME:-/home/opencode}/.git-credentials"

if [[ ! -f "$CREDS" ]]; then echo "ERROR: no existe ~/.git-credentials"; exit 1; fi
TOKEN="$(sed -E 's#https://[^:]+:([^@]+)@(.+)#\1#' "$CREDS")"
[[ -n "$TOKEN" ]] || { echo "ERROR: token vacío"; exit 1; }

# --- versionCode derivado (1.2.3 -> 10203) ---
MAJOR="${VERSION%%.*}"; REST="${VERSION#*.}"; MINOR="${REST%%.*}"; PATCH="${REST##*.}"
VCODE=$((MAJOR * 10000 + MINOR * 100 + PATCH))
echo ">> Version $VERSION (versionCode $VCODE)"

# --- bump en app/build.gradle ---
sed -i "s/versionCode [0-9]*/versionCode $VCODE/; s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" "$APP_DIR/app/build.gradle"
echo ">> versionCode/versionName actualizados en app/build.gradle"

# --- build + firma ---
export JAVA_HOME="$JAVA_HOME_DEF"
export PATH="$JAVA_HOME/bin:$PATH"
cd "$APP_DIR"
"$GRADLE_BIN" --no-daemon clean assembleRelease
APK="$APP_DIR/app/build/outputs/apk/release/app-release.apk"
[[ -f "$APK" ]] || { echo "ERROR: no se generó el APK"; exit 1; }
cp "$APK" "$DIST"
echo ">> APK: $DIST ($(stat -c%s "$DIST") bytes, sha256 $(sha256sum "$DIST" | cut -d' ' -f1))"

# --- commit + tag + push ---
cd "$ROOT"
git add -A
git -c user.name="sekaishopml" -c user.email="sekaishopml@users.noreply.github.com" commit -q -m "release: Kiosko v$VERSION" || echo ">> sin cambios para commit"
git tag -f "v$VERSION"
git push -q origin master
git push -q origin "v$VERSION"
echo ">> commit y tag v$VERSION subidos"

# --- release en GitHub ---
REL_ID="$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases" \
  -d "{\"tag_name\":\"v$VERSION\",\"target_commitish\":\"master\",\"name\":\"Kiosko v$VERSION\",\"body\":\"$MSG\",\"draft\":false,\"prerelease\":false}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")"
echo ">> release v$VERSION creado (id $REL_ID)"

curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=HotelDelValle-Kiosko.apk" \
  --data-binary @"$DIST" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('>> APK adjuntado:',d.get('browser_download_url'))"

echo ">> Listo: https://github.com/$REPO/releases/tag/v$VERSION"
