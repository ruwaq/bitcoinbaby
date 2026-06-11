#!/bin/bash
# =============================================================================
# BitcoinBaby — Pre-commit Secret Scanner
# =============================================================================
# Escanea archivos en staging en busca de:
#   1. Tokens de GitHub (ghp_, github_pat_)
#   2. Tokens de GitLab (glpat-)
#   3. Llaves privadas hexadecimales (64+ chars)
#   4. Private keys en formato WIF (5H, 5J, 5K, L, K)
#   5. URLs de remote con tokens hardcodeados (https://user:token@...)
#
# Bloquea el commit si encuentra algo sospechoso.
# =============================================================================

echo "🔍 BitcoinBaby Secret Scanner — verificando staged files..."

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  echo "   ✅ No hay archivos en staging."
  exit 0
fi

SECRETS_FOUND=0
EXCLUDE_PATTERN='pnpm-lock\.yaml$|\.png$|\.jpg$|\.ico$|\.svg$|\.lock$|\.test\.|\.spec\.|mock-|\/mock\/|\.gitignore$'

check_file() {
  local file="$1"
  local added_lines
  added_lines=$(git diff --cached "$file" | grep '^\+' | grep -v '^+++' || true)

  if [ -z "$added_lines" ]; then
    return
  fi

  # --- Pattern 1: GitHub Personal Access Tokens ---
  if echo "$added_lines" | grep -qE 'ghp_[a-zA-Z0-9]{36,}'; then
    echo "   🚨 GitHub PAT (classic) detectado en: $file"
    echo "$added_lines" | grep -nE 'ghp_[a-zA-Z0-9]{36,}' | head -3
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
  fi

  if echo "$added_lines" | grep -qE 'github_pat_[a-zA-Z0-9_]{22,}'; then
    echo "   🚨 GitHub PAT (fine-grained) detectado en: $file"
    echo "$added_lines" | grep -nE 'github_pat_[a-zA-Z0-9_]{22,}' | head -3
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
  fi

  # --- Pattern 2: GitLab Personal Access Tokens ---
  if echo "$added_lines" | grep -qE 'glpat-[a-zA-Z0-9_\-]{20,}'; then
    echo "   🚨 GitLab PAT detectado en: $file"
    echo "$added_lines" | grep -nE 'glpat-[a-zA-Z0-9_\-]{20,}' | head -3
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
  fi

  # --- Pattern 3: Private keys (hex 64 chars) ---
  local hex_matches
  hex_matches=$(echo "$added_lines" \
    | grep -v '0000000000000000000000000000000000000000000000000000000000000000' \
    | grep -v '1111111111111111111111111111111111111111111111111111111111111111' \
    | grep -v 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' \
    | grep -oE '\b[a-fA-F0-9]{64}\b' || true)

  if [ -n "$hex_matches" ]; then
    echo "   🚨 Posible llave privada (hex 64) detectada en: $file"
    echo "$hex_matches" | head -3
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
  fi

  # --- Pattern 4: WIF private keys (Bitcoin) ---
  if echo "$added_lines" | grep -qE '\b[5LK][1-9A-HJ-NP-Za-km-z]{50,51}\b'; then
    echo "   🚨 Posible WIF private key (Bitcoin) detectada en: $file"
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
  fi

  # --- Pattern 5: URLs with embedded credentials ---
  if echo "$added_lines" | grep -qE 'https://[^:]+:[^@]+@'; then
    echo "   🚨 URL con credenciales hardcodeadas detectada en: $file"
    echo "$added_lines" | grep -nE 'https://[^:]+:[^@]+@' | head -3
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
  fi
}

for FILE in $STAGED_FILES; do
  if echo "$FILE" | grep -qE "$EXCLUDE_PATTERN"; then
    continue
  fi
  check_file "$FILE"
done

if [ "$SECRETS_FOUND" -gt 0 ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "⚠️  COMMIT BLOQUEADO: Se detectaron $SECRETS_FOUND posible(s) secreto(s)."
  echo ""
  echo "   Si es un falso positivo, usa: git commit --no-verify"
  echo "   Si es un secreto real:"
  echo "     1. Revócalo inmediatamente en el proveedor"
  echo "     2. Muévelo a variables de entorno (.env)"
  echo "     3. Si ya estuvo en el historial, rota el secreto"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

echo "   ✅ No se detectaron secretos en staging."
exit 0
