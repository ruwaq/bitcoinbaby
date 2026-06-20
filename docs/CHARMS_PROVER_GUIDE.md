# Charms Prover Integration Guide

## Overview

Guía para integrar el prover de Charms v11 con BitcoinBaby para minting de tokens BABTC.

## Quick Start

```bash
# 1. Instalar CLI
./scripts/install-charms-cli.sh

# 2. Verificar instalación
charms --version  # v11.1.0+
```

## Problema Resuelto

La versión v0.11.1 del CLI de Charms tenía un bug que generaba transacciones con **inputs duplicados** al mismo UTXO (Issue #149). Esto causaba:

- `charms spell prove --mock` generaba TX con 2 inputs al mismo UTXO
- `charms spell prove` (real) hacía timeout después de 20+ minutos
- Error 502 Bad Gateway del prover remoto

**Solución**: Usar CLI v11.1.0+ compilado desde main branch.

## Instalación del CLI

### Automática (recomendado)

```bash
./scripts/install-charms-cli.sh
```

### Manual

```bash
# 1. Clonar el repositorio
git clone --depth 1 https://github.com/CharmsDev/charms.git /tmp/charms-build

# 2. Compilar SIN la feature prover (evita dependencias SP1)
cd /tmp/charms-build
cargo build --profile=test

# 3. Instalar
cargo install --profile=test --path . --locked

# 4. Verificar
charms --version  # Debe mostrar 11.1.0 o superior
```

## Formato de Spell V11

```yaml
version: 11

tx:
  ins:
    - "txid:vout"
  outs:
    - 0: <amount>  # app_index: token_amount
  coins:
    - amount: 700        # satoshis
      dest: "5120..."    # scriptPubKey hex completo

app_public_inputs:
  "t/identity_hex/vk_hex": ~  # null para minting
```

### Campos Importantes

| Campo | Descripción |
|-------|-------------|
| `ins` | UTXOs de entrada en formato "txid:vout" |
| `outs` | Outputs de tokens, key es índice de app (0) |
| `coins` | Outputs nativos de satoshis con dest |
| `dest` | scriptPubKey hex completo (ej: "5120" + 64 chars para P2TR) |
| `app_public_inputs` | Apps involucradas, null para mint simple |

## Integración TypeScript

### Crear Spell V11

```typescript
import { createBABTCMintSpellV11 } from "@bitcoinbaby/bitcoin";

const { spell, proverRequest } = createBABTCMintSpellV11({
  appId: "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b",
  appVk: "acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d",
  minerAddress: "tb1pdwap35ru90az875gghz58x9nut7gwqnzjh3dr3cgfdfkxkujt6zqy8ptxj",
  devAddress: "tb1pyqsfk4mywurzvjqn22gvnnprt4rjkdv7ak27wphxvj3mkuea3h2sfxlptk",
  stakingAddress: "tb1pjnkmx435gll8ncdr7mrfj7xrnjzt46resk6h7f897gf8kukw0js3qqt0fq",
  challenge: "1773921804:tb1pdwap35ru90az875gghz58x9nut7gwqnzjh3dr3cgfdfkxkujt6zqy8ptxj",
  nonce: "820",
  difficulty: 17,
  inputUtxo: { txid: "8a9d93bb...", vout: 1 },
  prevTxs: ["02000000000104..."],  // Hex de transacciones previas
  changeAddress: "tb1p...",
});
```

### Enviar al Prover

```typescript
import { CharmsProverClient } from "@bitcoinbaby/bitcoin";

const client = new CharmsProverClient({ debug: true });
const { commitTx, spellTx } = await client.proveV11(proverRequest);

// Firmar y broadcast ambas TXs
```

### Convertir Dirección a scriptPubKey

```typescript
import { addressToScriptPubKeyHex } from "@bitcoinbaby/bitcoin";

const dest = addressToScriptPubKeyHex(
  "tb1pdwap35ru90az875gghz58x9nut7gwqnzjh3dr3cgfdfkxkujt6zqy8ptxj",
  "testnet4"
);
// Returns: "51206bba18d07c2bfa23fa8845c54398b3e2fc87026295e2d1c7084b53635b925e84"
```

## Comandos CLI Útiles

```bash
# Obtener dest hash para una dirección
charms util dest --addr="tb1p..."

# Validar spell sin prover
charms spell check --spell=spell.yaml --prev-txs="<hex>" --app-bins=app.wasm

# Generar payload sin llamar API (debug)
charms spell prove --spell=spell.yaml --payload -o json

# Probar con prover real
charms spell prove \
  --spell=spell.yaml \
  --private-inputs=private.yaml \
  --prev-txs="<hex>" \
  --app-bins=app.wasm \
  --change-address="tb1p..." \
  --chain=bitcoin
```

## Troubleshooting

### Error: "unexpected argument '--funding-utxo'"
V11 no usa `--funding-utxo`. El funding se deriva del spell.

### Error: "cannot prove a mock==false spell on a mock==true prover"
Quitar `--mock` para proofs reales.

### Error: "coin_ins not populated"
Actualizar a CLI v11.1.0+ (Issue #149 fixed).

### Timeout después de 20+ min
Verificar que spell no tenga inputs duplicados. Usar v11.1.0+.

## Referencias

- [Issue #149: coin_ins fix](https://github.com/CharmsDev/charms/issues/149)
- [PR #161: --payload flag](https://github.com/CharmsDev/charms/pull/161)
- [Charms Docs](https://docs.charms.dev)
