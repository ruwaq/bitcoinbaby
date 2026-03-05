# BABTC Contract Deployment Keys

## Current Deployment (Testnet4)

| Key | Value |
|-----|-------|
| **App ID** | `87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b` |
| **App VK** | `acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d` |
| **Genesis UTXO** | `b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0` |
| **Network** | testnet4 |
| **Updated** | 2026-03-05 |

## App Reference String

```
t/87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b/acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d
```

## Contract Details

- **WASM Path**: `./target/wasm32-wasip1/release/babtc-contract.wasm`
- **SDK Version**: charms-sdk 11.0.1
- **CLI Version**: charms 0.11.1

## Prover Configuration

| Entorno | URL | Endpoint |
|---------|-----|----------|
| **Producción (Hosted)** | `https://v11.charms.dev` | `/spells/prove` |
| **Desarrollo (Local)** | `http://localhost:17784` | `/prove` |

### Prover Hosted de Charms

El prover hosted en `v11.charms.dev` es el más actualizado (confirmado por Charms team).
- Mantenido por Charms Inc.
- Funciona para mainnet y testnet4
- **Ya configurado por defecto** en BitcoinBaby

### Variables de Entorno (opcional)

```bash
# Override prover URL (opcional - por defecto usa hosted)
NEXT_PUBLIC_PROVER_URL=https://v11.charms.dev
# o para desarrollo local:
NEXT_PUBLIC_PROVER_URL=http://localhost:17784
```

---

## V9 Minting Flow (PoW Direct)

This is the recommended flow for on-chain BABTC minting.

### Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Mine PoW       │ ──▶  │  Create Spell   │ ──▶  │  Submit to      │
│  (CPU/WebGPU)   │      │  V9 with PoW    │      │  Prover         │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                           │
                         ┌─────────────────┐               ▼
                         │  Tokens in      │ ◀── ┌─────────────────┐
                         │  Wallet!        │     │  Sign & Broadcast│
                         └─────────────────┘     │  commit+spell TX │
                                                 └─────────────────┘
```

### Step 1: Mine PoW

The miner finds a valid hash:
- **Challenge**: `{timestamp}:{miner_address}`
- **Block Data**: `{challenge}:{nonce_hex}`
- **Hash**: `double_sha256(block_data)`
- **Valid if**: `leading_zeros(hash) >= difficulty`

Example:
```javascript
const challenge = "1709654321:tb1pxyz...";
const nonce = "abc123";
const blockData = `${challenge}:${nonce}`;
const hash = doubleSha256(blockData); // "0000abcd..."
// Valid if hash starts with enough zeros (D16 = 4 zeros)
```

### Step 2: Create Spell V9

```typescript
import { createBABTCMintSpellV9 } from "@bitcoinbaby/bitcoin";

const spell = createBABTCMintSpellV9({
  appId: "87b5ecfb...",
  appVk: "acf2ec0b...",
  minerAddress: "tb1p...",
  devAddress: "tb1p...",
  stakingAddress: "tb1p...",
  challenge: "1709654321:tb1pxyz...",
  nonce: "abc123",
  difficulty: 16,
  inputUtxo: { txid: "...", vout: 0 },
});
```

### Step 3: Submit to Prover

```typescript
import { createCharmsProverClient } from "@bitcoinbaby/bitcoin";

const prover = createCharmsProverClient();
const { commitTx, spellTx } = await prover.provePoW(spell);
```

### Step 4: Sign and Broadcast

```typescript
// Sign both transactions with your wallet
const signedCommit = await wallet.signTransaction(commitTx);
const signedSpell = await wallet.signTransaction(spellTx);

// Broadcast to Bitcoin network
await broadcastTransaction(signedCommit);
await broadcastTransaction(signedSpell);

// Tokens appear after confirmation!
```

### Spell YAML Format

For CLI testing:

```yaml
apps:
  $01: t/87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b/acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d

ins:
  - utxo_id: "txid:0"
    charms: {}

outs:
  - address: "tb1p_miner..."
    charms:
      $01: 230400000  # 90% miner share
    sats: 700
  - address: "tb1p_dev..."
    charms:
      $01: 12800000   # 5% dev share
    sats: 700
  - address: "tb1p_staking..."
    charms:
      $01: 12800000   # 5% staking share
    sats: 700

private_inputs:
  $01:
    pow_challenge: "1709654321:tb1pxyz..."
    pow_nonce: "abc123"
    pow_difficulty: 16
```

### Test with CLI

```bash
# 1. Save spell as spell-v9.yaml
# 2. Validate
charms spell check --spell=spell-v9.yaml

# 3. Generate proof (requires local prover)
charms server &
charms spell prove --spell=spell-v9.yaml

# 4. Cast (prove + sign + broadcast)
charms spell cast --spell=spell-v9.yaml
```

### Reward Formula (BRO-style)

```
reward = BASE_REWARD × D² ÷ DIFFICULTY_FACTOR
```

Where:
- BASE_REWARD = 1 BABTC (100,000,000 base units)
- DIFFICULTY_FACTOR = 100
- D = difficulty (leading zero bits)

Examples:
| Difficulty | Total Reward | Miner (90%) |
|------------|-------------|-------------|
| D16 (min)  | 2.56 BABTC  | 2.30 BABTC  |
| D20        | 4.00 BABTC  | 3.60 BABTC  |
| D22        | 4.84 BABTC  | 4.36 BABTC  |
| D24        | 5.76 BABTC  | 5.18 BABTC  |
| D32 (max)  | 10.24 BABTC | 9.22 BABTC  |

---

## Regenerate VK

If you rebuild the contract, regenerate the VK:

```bash
cd packages/bitcoin/contracts/babtc
charms app build
charms app vk ./target/wasm32-wasip1/release/babtc-contract.wasm
```

Then update:
1. This file
2. `packages/bitcoin/src/config/deployment.ts`

## Configuration Files

- Deployment config: `packages/bitcoin/src/config/deployment.ts`
- Token config: `packages/bitcoin/src/charms/token.ts`
- Build instructions: `BUILD.md`
- Test script: `packages/bitcoin/scripts/test-v9-flow.ts`
