# BABTC Contract Build Instructions

## Prerequisites

- Rust with wasm32-wasip1 target: `rustup target add wasm32-wasip1`
- Charms CLI: `cargo install charms-cli`

## Build

```bash
cd packages/bitcoin/contracts/babtc

# Build the contract
charms app build

# Output: ./target/wasm32-wasip1/release/babtc-contract.wasm
```

## Get Verification Key

```bash
charms app vk ./target/wasm32-wasip1/release/babtc-contract.wasm
# Output: 72cddbf02e3412f92ed134fd88dffdfa918c74faf5695db118ff6cb98fc602f0
```

## Test Spell

```bash
# 1. Create a valid PoW (for testing)
# The contract validates: SHA256(challenge + nonce) has >= D leading zeros

# 2. Run spell check
charms spell check \
  --spell spells/mint.yaml \
  --prev-txs <hex> \
  --app-bins ./target/wasm32-wasip1/release/babtc-contract.wasm \
  --mock
```

## Contract Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| MIN_DIFFICULTY | 16 | Minimum leading zero bits |
| BASE_REWARD | 1 BABTC | Base reward (100,000,000 units) |
| DIFFICULTY_FACTOR | 100 | Divisor for reward calculation |
| MINER_SHARE | 90% | Miner's portion |
| DEV_SHARE | 5% | Dev fund portion |
| STAKING_SHARE | 5% | Staking pool portion |

## Reward Formula

```
reward = BASE_REWARD × D² ÷ DIFFICULTY_FACTOR
```

Examples:
- D16: 1 × 256 / 100 = 2.56 BABTC
- D20: 1 × 400 / 100 = 4.00 BABTC
- D22: 1 × 484 / 100 = 4.84 BABTC
- D24: 1 × 576 / 100 = 5.76 BABTC

## Hash Verification

The contract uses single SHA256 for PoW verification:
```
hash = SHA256(challenge + nonce)
```

Format:
- challenge: String (e.g., "mining_test_1234567890")
- nonce: Hex string (e.g., "1ef16")
- No separator between challenge and nonce

## Deployment

Current deployment (testnet4):
- App ID: `87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b`
- App VK: `72cddbf02e3412f92ed134fd88dffdfa918c74faf5695db118ff6cb98fc602f0`

Configuration: `packages/bitcoin/src/config/deployment.ts`
