#!/usr/bin/env bash
# bump-version.sh — Bump ATÓMICO y verificado de la versión del Kiosco (Fase A).
# Uso: ./scripts/bump-version.sh <x.y.z>   (ej. 1.3.1)
#
# Actualiza las 4 fuentes de versión y deja el worktree listo.
# NO commitea NI tagea: revisa el diff y commitea a mano.
#   1. web/kiosco/package.json                                   → version
#   2. web/kiosco-version.json                                   → version + versionCode+1
#   3. android-shell/app/build.gradle                            → versionName + versionCode+1
#   4. android-shell/.../MainActivity.kt                         → APP_VERSION
#
# Garantías:
#   - Valida semver estricto x.y.z y que la nueva versión sea mayor.
#   - FALLA si las 4 fuentes no están sincronizadas antes del bump.
#   - Re-verifica sincronía después del bump y muestra el diff.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NEW="${1:?Uso: ./scripts/bump-version.sh <x.y.z> (ej. 1.3.1)}"

PKG="$ROOT/web/kiosco/package.json"
MANIFEST="$ROOT/web/kiosco-version.json"
GRADLE="$ROOT/android-shell/app/build.gradle"
MAIN="$ROOT/android-shell/app/src/main/java/com/hoteldelvalle/kiosco/MainActivity.kt"

# --- 1. validar semver x.y.z ---
if ! [[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: '$NEW' no es semver x.y.z (ej. 1.3.1)." >&2
  exit 1
fi

# --- 2. leer estado actual ---
PKG_V="$(sed -nE 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$PKG" | head -n1)"
MF_V="$(python3 -c "import json;print(json.load(open('$MANIFEST')).get('version',''))")"
MF_CODE="$(python3 -c "import json;print(json.load(open('$MANIFEST')).get('versionCode',''))")"
GRADLE_NAME="$(sed -nE 's/.*versionName[[:space:]]+"([^"]+)".*/\1/p' "$GRADLE" | head -n1)"
GRADLE_CODE="$(sed -nE 's/.*versionCode[[:space:]]+([0-9]+).*/\1/p' "$GRADLE" | head -n1)"
APP_V="$(sed -nE 's/.*APP_VERSION[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$MAIN" | head -n1)"

echo ">> actual: package.json=$PKG_V manifest=$MF_V/$MF_CODE gradle=$GRADLE_NAME/$GRADLE_CODE MainActivity=$APP_V"

# --- 3. exigir sincronía previa ---
if [[ "$PKG_V" != "$MF_V" || "$MF_V" != "$GRADLE_NAME" || "$GRADLE_NAME" != "$APP_V" ]]; then
  echo "ERROR: versiones desincronizadas (package.json=$PKG_V manifest=$MF_V gradle=$GRADLE_NAME MainActivity=$APP_V). Sincroniza a mano antes del bump." >&2
  exit 1
fi
if ! [[ "$GRADLE_CODE" =~ ^[0-9]+$ ]]; then
  echo "ERROR: versionCode de build.gradle no numérico ('$GRADLE_CODE')." >&2
  exit 1
fi
if [[ -z "$MF_CODE" ]]; then
  echo ">> AVISO: manifiesto sin versionCode (formato pre-Fase A); se adopta el de build.gradle ($GRADLE_CODE)."
  MF_CODE="$GRADLE_CODE"
fi
if [[ "$MF_CODE" != "$GRADLE_CODE" ]]; then
  echo "ERROR: versionCode desincronizado (manifest=$MF_CODE gradle=$GRADLE_CODE). Sincroniza a mano antes del bump." >&2
  exit 1
fi
if [[ "$NEW" == "$PKG_V" ]]; then
  echo "ERROR: la nueva versión $NEW es igual a la actual." >&2
  exit 1
fi
if [[ "$(printf '%s\n%s\n' "$PKG_V" "$NEW" | sort -V | head -n1)" != "$PKG_V" ]]; then
  echo "ERROR: la nueva versión $NEW debe ser mayor que la actual $PKG_V." >&2
  exit 1
fi

NEW_CODE=$((MF_CODE + 1))

# --- 4. aplicar bump ---
sed -i -E "s/(\"version\"[[:space:]]*:[[:space:]]*\")$PKG_V(\")/\1$NEW\2/" "$PKG"
python3 - "$MANIFEST" "$NEW" "$NEW_CODE" <<'EOF'
import json, sys
p, ver, code = sys.argv[1], sys.argv[2], int(sys.argv[3])
with open(p) as f:
    data = json.load(f)
data["version"] = ver
data["versionCode"] = code
with open(p, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
EOF
sed -i -E "s/(versionName[[:space:]]+\")$GRADLE_NAME(\")/\1$NEW\2/" "$GRADLE"
sed -i -E "s/(versionCode[[:space:]]+)$GRADLE_CODE([^0-9]|$)/\1$NEW_CODE\2/" "$GRADLE"
sed -i -E "s/(APP_VERSION[[:space:]]*=[[:space:]]*\")$APP_V(\")/\1$NEW\2/" "$MAIN"

# --- 5. re-verificar sincronía post-bump ---
PKG_V2="$(sed -nE 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$PKG" | head -n1)"
MF_V2="$(python3 -c "import json;print(json.load(open('$MANIFEST')).get('version',''))")"
MF_CODE2="$(python3 -c "import json;print(json.load(open('$MANIFEST')).get('versionCode',''))")"
GRADLE_NAME2="$(sed -nE 's/.*versionName[[:space:]]+"([^"]+)".*/\1/p' "$GRADLE" | head -n1)"
GRADLE_CODE2="$(sed -nE 's/.*versionCode[[:space:]]+([0-9]+).*/\1/p' "$GRADLE" | head -n1)"
APP_V2="$(sed -nE 's/.*APP_VERSION[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$MAIN" | head -n1)"
if [[ "$PKG_V2" != "$NEW" || "$MF_V2" != "$NEW" || "$GRADLE_NAME2" != "$NEW" || "$APP_V2" != "$NEW" \
   || "$MF_CODE2" != "$NEW_CODE" || "$GRADLE_CODE2" != "$NEW_CODE" ]]; then
  echo "ERROR: verificación post-bump falló (pkg=$PKG_V2 mf=$MF_V2/$MF_CODE2 gradle=$GRADLE_NAME2/$GRADLE_CODE2 main=$APP_V2)." >&2
  exit 1
fi

# --- 6. diff (sin commit ni tag) ---
git -C "$ROOT" diff -- "$PKG" "$MANIFEST" "$GRADLE" "$MAIN"
echo ">> bump $PKG_V ($GRADLE_CODE) → $NEW ($NEW_CODE) listo. SIN commit ni tag: revisa el diff y commitea a mano."
