# Charms V11 Prover Format

## Resumen

El prover V11 (v11.charms.dev) requiere un formato específico para generar proofs.
Este documento describe el formato correcto basado en pruebas exitosas.

## Request Format

```typescript
interface ProverRequest {
  // Spell CBOR-encoded como hex string (NO JSON directo)
  spell: string;

  // UTXO de funding
  funding_utxo: string;        // "txid:vout"
  funding_utxo_value: number;  // Sats disponibles

  // Dirección para cambio
  change_address: string;      // "tb1p..." o "bc1p..."

  // Chain y fee
  chain: "bitcoin";
  fee_rate: number;            // Sats/vB (ej: 2.0)

  // Transacciones previas (REQUERIDO)
  prev_txs: Array<{ bitcoin: string }>;  // Raw tx hex

  // Binarios de contratos custom (REQUERIDO para apps no registrados)
  binaries: {
    [vk: string]: string;      // VK hex -> WASM base64
  };
}
```

## Spell CBOR Structure

El spell debe ser CBOR-encoded con tipos específicos:

```typescript
const spell = {
  version: 11,
  tx: {
    // Inputs como bytes de 36 bytes cada uno
    // [32 bytes txid reversed] + [4 bytes index little-endian]
    ins: [Uint8Array(36)],

    // Outputs como Map con keys enteros
    outs: [Map<number, NFTState>],

    // Coins con script pubkey como bytes
    coins: [{
      amount: 330,              // NFT dust
      dest: Uint8Array          // Script pubkey bytes
    }]
  },

  // App public inputs como Map con tuple keys
  app_public_inputs: Map<AppTuple, null>
};

// AppTuple format: [tag, identity_bytes, vk_bytes]
type AppTuple = [string, Uint8Array, Uint8Array];
// Ejemplo: ["n", identity_32_bytes, vk_32_bytes]
```

## Conversiones Importantes

### UTXO String a Bytes
```typescript
function utxoToBytes(utxoStr: string): Uint8Array {
  const [txidHex, indexStr] = utxoStr.split(":");
  const bytes = new Uint8Array(36);

  // Reverse txid (Bitcoin display order)
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(txidHex.substr((31 - i) * 2, 2), 16);
  }

  // Index as little-endian u32
  const index = parseInt(indexStr, 10);
  bytes[32] = index & 0xff;
  bytes[33] = (index >> 8) & 0xff;
  bytes[34] = (index >> 16) & 0xff;
  bytes[35] = (index >> 24) & 0xff;

  return bytes;
}
```

### Address a Script Pubkey
```typescript
// Para P2TR (tb1p.../bc1p...):
// OP_1 (0x51) + push_32 (0x20) + 32_byte_key
// Resultado: 34 bytes
```

## Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `expected a string` | spell es JSON object | Encode spell a CBOR hex string |
| `missing field chain` | Falta campo chain | Agregar `chain: "bitcoin"` |
| `coins must be present` | Falta tx.coins | Agregar coins con amount y dest |
| `prev_txs MUST contain` | Falta prev_txs | Fetch raw tx del funding UTXO |
| `binaries must contain` | Falta binaries | Agregar VK -> WASM base64 |
| `502 Server Error` | Prover crash | Verificar CBOR encoding, revisar binarios |

## VK (Verification Key)

El VK es SHA256 del WASM binary:
```bash
cat contract.wasm | shasum -a 256 | cut -d' ' -f1
```

## SDK Compatibility

| SDK Version | Prover |
|-------------|--------|
| charms-sdk 11.0.x | v11.charms.dev |
| charms-sdk 0.10.x | v10.charms.dev |

**IMPORTANTE**: El binario debe estar compilado con la versión de SDK
compatible con el prover que se usa.

## Ejemplo Exitoso

Request que funcionó:
- Endpoint: `https://v11.charms.dev/spells/prove`
- SDK: charms-sdk 11.0.1
- Contrato: Ultra-minimal NFT
- Body size: ~321KB (incluye binary base64)
- Response time: ~50-180 segundos (proof generation)

## Archivos Relevantes

- Servicio: `apps/workers/src/services/nft-minting-simple.ts`
- Binario: `apps/workers/src/lib/nft-contract-binary.ts`
- Contrato: `packages/bitcoin/contracts/genesis-babies/src/lib.rs`
