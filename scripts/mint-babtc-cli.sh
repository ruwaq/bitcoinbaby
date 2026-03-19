#!/bin/bash
#
# BABTC Token Minting via Charms CLI
#
# Usage:
#   ./scripts/mint-babtc-cli.sh
#
# Requirements:
#   - Charms CLI installed (charms 11.x)
#   - WASM contract built
#   - Funded testnet4 wallet
#

set -e

# Config
APP_ID="87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b"
APP_VK="acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d"
WASM_PATH="./packages/bitcoin/contracts/babtc/target/wasm32-wasip1/release/babtc-contract.wasm"

# Addresses
MINER_ADDRESS="tb1phkt7ueqfl5539wp5phc8hvsqd9csuj8qwp48p842y0ypt98y3fus9vf8zp"
DEV_ADDRESS="tb1pyzpxkhve8wrztypx62g8pnfr2axdh4n97m9a8pwveytkkn3ar02sp592z3"
STAKING_ADDRESS="tb1pjnkc6432y0muu7r0mwrxj0sc8y9kaq7dsh477xfuk5faannhe9psxkkqmc"

# Mining params (matching contract)
MIN_DIFFICULTY=16
BASE_REWARD=100000000  # 1 BABTC in base units
DIFFICULTY_FACTOR=100
TIMESTAMP=$(date +%s)
CHALLENGE="${TIMESTAMP}:${MINER_ADDRESS}"

echo "=========================================="
echo "  BABTC MINTING via CHARMS CLI"
echo "=========================================="
echo ""
echo "App: t/${APP_ID:0:16}.../${APP_VK:0:16}..."
echo "Miner: ${MINER_ADDRESS}"
echo ""

# Get UTXO
echo "[1/5] Fetching UTXO..."
UTXO_JSON=$(curl -s "https://mempool.space/testnet4/api/address/${MINER_ADDRESS}/utxo" | jq '.[0]')
TXID=$(echo "$UTXO_JSON" | jq -r '.txid')
VOUT=$(echo "$UTXO_JSON" | jq -r '.vout')
VALUE=$(echo "$UTXO_JSON" | jq -r '.value')
echo "  UTXO: ${TXID}:${VOUT} (${VALUE} sats)"

# Get prev tx
echo "[2/5] Fetching previous transaction..."
PREV_TX=$(curl -s "https://mempool.space/testnet4/api/tx/${TXID}/hex")
echo "  Got tx: ${PREV_TX:0:40}..."

# Double SHA256 function (Bitcoin standard)
double_sha256() {
  # First hash as raw bytes, then second hash
  echo -n "$1" | openssl dgst -sha256 -binary | openssl dgst -sha256 -binary | xxd -p -c 64
}

# Count leading zero bits in hex string
count_zeros() {
  local hash="$1"
  local zeros=0
  for ((i=0; i<${#hash}; i++)); do
    local char="${hash:$i:1}"
    case "$char" in
      0) zeros=$((zeros + 4)) ;;
      1) zeros=$((zeros + 3)); break ;;
      2|3) zeros=$((zeros + 2)); break ;;
      4|5|6|7) zeros=$((zeros + 1)); break ;;
      *) break ;;
    esac
  done
  echo $zeros
}

# Mine with double SHA256
echo "[3/5] Mining PoW (double SHA256)..."
NONCE=0
while true; do
  NONCE_HEX=$(printf '%08x' $NONCE)
  BLOCK_DATA="${CHALLENGE}:${NONCE_HEX}"
  HASH=$(double_sha256 "$BLOCK_DATA")
  ZEROS=$(count_zeros "$HASH")

  if [ $ZEROS -ge $MIN_DIFFICULTY ]; then
    echo "  Found! Nonce: ${NONCE_HEX}, Hash: ${HASH}, Difficulty: ${ZEROS}"
    break
  fi

  NONCE=$((NONCE + 1))
  if [ $((NONCE % 10000)) -eq 0 ]; then
    echo -ne "\r  Hashes: ${NONCE}..."
  fi
done

# Calculate reward (contract formula: BASE_REWARD * D^2 / DIFFICULTY_FACTOR)
# D^2 = ZEROS * ZEROS
D_SQUARED=$((ZEROS * ZEROS))
TOTAL_REWARD=$((BASE_REWARD * D_SQUARED / DIFFICULTY_FACTOR))

# Distribution: 90% miner, 5% dev, 5% staking (matching contract)
MINER_REWARD=$((TOTAL_REWARD * 90 / 100))
DEV_REWARD=$((TOTAL_REWARD * 5 / 100))
STAKING_REWARD=$((TOTAL_REWARD - MINER_REWARD - DEV_REWARD))

echo ""
echo "[4/5] Creating spell..."
echo "  Difficulty: ${ZEROS} bits"
echo "  Total reward: ${TOTAL_REWARD} BABTC units ($(echo "scale=2; $TOTAL_REWARD / 100000000" | bc) BABTC)"
echo "  Miner (90%): ${MINER_REWARD}"
echo "  Dev (5%): ${DEV_REWARD}"
echo "  Staking (5%): ${STAKING_REWARD}"

# Get dest values
MINER_DEST=$(charms util dest --addr "${MINER_ADDRESS}" --chain bitcoin 2>/dev/null)
DEV_DEST=$(charms util dest --addr "${DEV_ADDRESS}" --chain bitcoin 2>/dev/null)
STAKING_DEST=$(charms util dest --addr "${STAKING_ADDRESS}" --chain bitcoin 2>/dev/null)

# Create spell YAML
SPELL_FILE=$(mktemp /tmp/spell.XXXXXX.yaml)
cat > "$SPELL_FILE" << EOF
version: 11
tx:
  ins:
    - "${TXID}:${VOUT}"
  outs:
    - 0: ${MINER_REWARD}
    - 0: ${DEV_REWARD}
    - 0: ${STAKING_REWARD}
  coins:
    - amount: 700
      dest: ${MINER_DEST}
    - amount: 700
      dest: ${DEV_DEST}
    - amount: 700
      dest: ${STAKING_DEST}
app_public_inputs:
  t/${APP_ID}/${APP_VK}: ~
EOF

echo "  Spell saved to: ${SPELL_FILE}"
cat "$SPELL_FILE"

# Create private inputs (field names matching contract MiningWitness struct)
PRIVATE_FILE=$(mktemp /tmp/private.XXXXXX.yaml)
cat > "$PRIVATE_FILE" << EOF
t/${APP_ID}/${APP_VK}:
  challenge: "${CHALLENGE}"
  nonce: "${NONCE_HEX}"
  difficulty: ${ZEROS}
EOF

echo ""
echo "  Private inputs saved to: ${PRIVATE_FILE}"
cat "$PRIVATE_FILE"

# Prove
echo ""
echo "[5/5] Proving spell (this may take several minutes)..."
echo "  Using WASM: ${WASM_PATH}"

charms spell prove \
  --spell "${SPELL_FILE}" \
  --private-inputs "${PRIVATE_FILE}" \
  --app-bins "${WASM_PATH}" \
  --prev-txs "${PREV_TX}" \
  --change-address "${MINER_ADDRESS}" \
  --fee-rate 2.0 \
  --chain bitcoin

echo ""
echo "Done! Sign and broadcast the transactions above."

# Cleanup
rm -f "$SPELL_FILE" "$PRIVATE_FILE"
