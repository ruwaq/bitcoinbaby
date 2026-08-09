#!/usr/bin/env bash
# =============================================================================
# BitcoinBaby — Contract VK reproducibility check (local guard)
# =============================================================================
# Builds each Charms contract from source (wasm32-wasip1) and compares the
# resulting wasm sha256 against the VK declared in the embedded
# *-contract-binary.ts file. Detects supply-chain / staleness drift the same
# way the `contract-vk-check` job in .github/workflows/ci.yml does.
#
# Why local: GitHub Actions is currently disabled on the repo, so the CI job
# never runs. This script + the pre-push hook close that gap until Actions is
# re-enabled. See docs/audits/VK_RECONCILIATION.md (Fase 0.3) and
# docs/superpowers/notes/SESSION-9-HANDOFF.md §1.
#
# Exit codes:
#   0  advisory (default) — always, even on mismatch; just reports
#   1  --strict mode and at least one contract is STALE (use in CI / release)
#   2  setup error (no cargo / rustup, missing target) — never silently pass
#
# Usage:
#   ./scripts/verify-vks.sh            # advisory (pre-push default)
#   ./scripts/verify-vks.sh --strict   # fail on any STALE (CI)
#   ./scripts/verify-vks.sh --no-build # skip cargo build, just recompare
# =============================================================================
set -euo pipefail

STRICT=0
DO_BUILD=1
for arg in "$@"; do
  case "$arg" in
    --strict)    STRICT=1 ;;
    --no-build)  DO_BUILD=0 ;;
    -h|--help)
      sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# --- toolchain gate --------------------------------------------------------
# A dev without Rust should not be blocked: warn loudly and exit 0 in advisory
# mode (the contract couldn't have changed). In --strict we fail — CI must have
# the toolchain.
if ! command -v cargo >/dev/null 2>&1; then
  echo "⚠️  cargo not found on PATH — skipping VK verification." >&2
  echo "    Install Rust + 'rustup target add wasm32-wasip1' to enable." >&2
  if [ "$STRICT" = "1" ]; then exit 2; fi
  exit 0
fi

if ! rustup target list --installed 2>/dev/null | grep -q wasm32-wasip1; then
  echo "⚠️  wasm32-wasip1 target not installed — skipping VK verification." >&2
  echo "    Run: rustup target add wasm32-wasip1" >&2
  if [ "$STRICT" = "1" ]; then exit 2; fi
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS="$ROOT/packages/bitcoin/contracts"
BINARIES="$ROOT/apps/workers/src/lib"

# contract-dir | artifact-wasm-name | embedded-binary-ts
MAP=(
  "babtc|babtc-contract.wasm|babtc-contract-binary.ts"
  "babtc-v2|babtc-v2-contract.wasm|babtc-v2-contract-binary.ts"
  "genesis-babies|genesis-babies.wasm|nft-contract-binary.ts"
)

declare -a RESULTS
STALE_COUNT=0

echo "🔍 BitcoinBaby VK reproducibility check"
echo "    mode: $([ "$STRICT" = "1" ] && echo STRICT || echo advisory)"
echo

for entry in "${MAP[@]}"; do
  IFS='|' read -r contract wasm_name ts_file <<< "$entry"
  dir="$CONTRACTS/$contract"
  ts="$BINARIES/$ts_file"

  # Declared VK = first 64-hex string in the embedded TS file.
  declared=$(grep -oE '"[a-f0-9]{64}"' "$ts" | head -1 | tr -d '"' || true)

  if [ -z "$declared" ]; then
    RESULTS+=("$contract|??|??|NO_DECLARED_VK|$ts")
    STALE_COUNT=$((STALE_COUNT + 1))
    continue
  fi

  if [ "$DO_BUILD" = "1" ]; then
    ( cd "$dir" && cargo build --release --target wasm32-wasip1 --locked ) >/dev/null 2>&1 || {
      echo "❌ cargo build failed for $contract — run manually to see errors:" >&2
      echo "    (cd $dir && cargo build --release --target wasm32-wasip1 --locked)" >&2
      exit 2
    }
  fi

  built_wasm="$dir/target/wasm32-wasip1/release/$wasm_name"
  if [ ! -f "$built_wasm" ]; then
    echo "❌ expected artifact not found: $built_wasm" >&2
    echo "    artifact name may have changed — verify [package].name in $dir/Cargo.toml" >&2
    exit 2
  fi
  built=$(sha256sum "$built_wasm" | awk '{print $1}')

  if [ "$built" = "$declared" ]; then
    state="MATCH"
  else
    state="STALE"
    STALE_COUNT=$((STALE_COUNT + 1))
  fi
  RESULTS+=("$contract|$declared|$built|$state|$ts_file")
done

# --- report ----------------------------------------------------------------
printf "  %-18s %-10s %-20s %s\n" "CONTRACT" "STATE" "DECLARED" "BUILT"
printf "  %-18s %-10s %-20s %s\n" "--------" "-----" "--------" "-----"
for r in "${RESULTS[@]}"; do
  IFS='|' read -r c decl built state tsf <<< "$r"
  printf "  %-18s %-10s %-20s %s\n" "$c" "$state" "${decl:0:16}.." "${built:0:16}.."
done
echo
echo "  embedded TS files:"
for r in "${RESULTS[@]}"; do
  IFS='|' read -r c decl built state tsf <<< "$r"
  printf "    %-18s → apps/workers/src/lib/%s\n" "$c" "$tsf"
done
echo

if [ "$STALE_COUNT" -gt 0 ]; then
  echo "⚠️  $STALE_COUNT/$(( ${#MAP[@]} )) contract(s) STALE: embedded binary does not match"
  echo "    the wasm built from current source."
  echo
  echo "    This is NOT necessarily a bug:"
  echo "      - If the contract changed recently, the embedded binary must be"
  echo "        regenerated AND redeployed on-chain (testnet4 reset)."
  echo "      - If regeneration is intentionally deferred, the embedded VKs"
  echo "        stay aligned with the on-chain deployment — see"
  echo "        docs/audits/VK_RECONCILIATION.md and SESSION-9-HANDOFF.md §1."
  echo
  if [ "$STRICT" = "1" ]; then
    echo "❌ FAIL (--strict): refusing to pass with STALE binaries."
    exit 1
  fi
  echo "ℹ️  advisory mode — not blocking. Re-run with --strict to enforce."
  exit 0
fi

echo "✅ All ${#MAP[@]} contracts MATCH — embedded binaries reproducible from source."
exit 0
