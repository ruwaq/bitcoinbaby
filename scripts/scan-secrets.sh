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
  # Excludes obvious test vectors: all-zeros/ones/ff key, and the two
  # canonical bitcoin test txids (...0001 / ...0002) used as fixtures.
  # Also excludes PUBLIC Charms verification keys (VKs) — both the embedded
  # ones (deployed on-chain) and the current-source cargo-build VKs — and the
  # babtc genesis UTXO txid. These are public by design
  # (see docs/audits/VK_RECONCILIATION.md and SESSION-9-HANDOFF.md §1).
  local hex_matches
  hex_matches=$(echo "$added_lines" \
    | grep -v '0000000000000000000000000000000000000000000000000000000000000000' \
    | grep -v '1111111111111111111111111111111111111111111111111111111111111111' \
    | grep -v 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' \
    | grep -v '0000000000000000000000000000000000000000000000000000000000000001' \
    | grep -v '0000000000000000000000000000000000000000000000000000000000000002' \
    | grep -v 'ab70796e62562b5245cf746d7ecf4b95b86df582921ae42ec2ceea25612807c6' \
    | grep -v 'acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d' \
    | grep -v 'bad3cb4ea58df065d0ed0ad01dde1d9132e8e30fbdef3c324f81109463b7b67d' \
    | grep -v '0d9483a760ef91eef606e84fbff326132b3e611bc913025913bc34b6655b08ba' \
    | grep -v '72cddbf02e3412f92ed134fd88dffdfa918c74faf5695db118ff6cb98fc602f0' \
    | grep -v 'b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81' \
    | grep -v '3f0fcafea6303322ee29acaa39ee8da69f3dc3fee68a77a3d897bed745f9ebc8' \
    | grep -v '8ffa21e1702455e7464e003a276eabb9a5e06b8c1948c3e317a67c3447536706' \
    | grep -v '2501737a1bd73549677f276e0c93ce87328b076cfe1cacd9f493b50c7f435ae2' \
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
