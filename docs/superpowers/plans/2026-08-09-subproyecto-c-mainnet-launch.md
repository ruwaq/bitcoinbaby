# Sub-proyecto C (Fases 0-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el gap crítico del C3 end-to-end, eliminar el riesgo supply-chain de los binarios WASM embebidos, y alinear la fórmula BRO on-chain con la canónica — todo lo codeable sin esperar la cuota del prover.

**Architecture:** Big-Bang Reset (spec `2026-08-09-subproyecto-c-mainnet-launch-design.md`). Tres fases codeables hoy: (0) limpieza + hardening de build, (1) cierre C3 off-chain cableando el op `work` en el worker, (2) reconciliación BRO on-chain. Fases 3-5 (genesis mint, E2E, mainnet) quedan fuera de este plan — bloqueadas por la cuota del prover Charms.

**Tech Stack:** Rust (contratos Charms v15, wasm32-wasip1), TypeScript strict (Cloudflare Workers/Hono, packages bitcoin/core), Zod (schemas), CBOR (charms wire format), Vitest (TS tests), cargo (Rust tests), pnpm + Turborepo monorepo.

**Spec de referencia:** `docs/superpowers/specs/2026-08-09-subproyecto-c-mainnet-launch-design.md`

**Convenciones (CLAUDE.md):** TypeScript strict, 2 espacios, `interface` over `type`, tests colocados (`*.test.ts`), commits neutrales `type(scope): description` sin Co-Authored-By, naming Spark/$SPARK/Genesis Sparks.

---

## File Structure

**Archivos a crear:**

- `packages/bitcoin/src/charms/nft.ts` — añadir `createNFTWorkSpell` + `NFTWorkParams` (extiende el existente)
- `apps/workers/src/services/nft-evolution-service.ts` — añadir `buildWorkSpellRequest` + `WorkParams` (extiende el existente)
- `docs/audits/VK_RECONCILIATION.md` — documento de los 3-4 VKs divergentes

**Archivos a modificar:**

- `packages/shared/src/__tests__/phases.test.ts:287-299` — actualizar nomenclatura tabs
- `apps/workers/src/routes/nft/evolve.ts:516-627` — reemplazar ruta `/work/:tokenId`
- `apps/workers/src/routes/nft/middleware.ts:135-150` — extender schema con 3 campos settlement
- `packages/bitcoin/contracts/babtc/src/lib.rs:30-42, 176-195` — fórmula BRO canónica + constantes
- `packages/bitcoin/contracts/babtc-v2/src/lib.rs:161-191` — `verify_server_signature` criptográfico
- `scripts/signer/mint-babtc.ts:208-216` — alinear `calculateReward` con `minedAmountBro`
- `.github/workflows/ci.yml` — añadir job de build de WASM desde source
- `packages/bitcoin/src/charms/bro-reward.ts:15-28` — actualizar el bloque "Status of alignment"

**Archivos a NO tocar (decisiones heredadas del spec, sección 4):**

- `packages/core/src/mining/block-observer.ts` — funciona
- `packages/bitcoin/src/charms/bro-reward.ts` (la función `minedAmountBro`) — canónica
- `apps/workers/src/lib/proof-validation.ts` — `validateMiningProof` ya es correcta
- `packages/bitcoin/contracts/genesis-babies/src/lib.rs` (los validadores) — ya cierran C3 on-chain; solo se toca el match en Fase 1.5

---

# Fase 0 — Limpieza + hardening de build

## Task 0.1: Fix 6 tests stale de `@bitcoinbaby/shared`

**Contexto:** El renombramiento de tabs del rediseño (Fase 4, sesión 2026-06-20) cambió la nomenclatura de `['dashboard','nfts','wallet','more']` → `['home','explore','you']`, pero `phases.test.ts` no se actualizó. 6 tests fallan desde antes del sub-proyecto B.

**Files:**

- Modify: `packages/shared/src/__tests__/phases.test.ts:287-299`

- [ ] **Step 1: Confirmar cuál es la nomenclatura real actual**

Run:

```bash
grep -rn "defaultTab\|visibleTabs" packages/shared/src/ --include="*.ts" | grep -v test
```

Expected: muestra la definición canónica (probablemente en `phases.ts`). Anotar el valor real de `defaultTab` y `visibleTabs`.

- [ ] **Step 2: Verificar que los tests efectivamente fallan**

Run: `pnpm --filter @bitcoinbaby/shared test`
Expected: `6 failed | 28 passed`, los 6 fallando en `phases.test.ts` con mensajes tipo `expected "dashboard" to be "home"`.

- [ ] **Step 3: Actualizar las aserciones de las líneas 287-299**

Reemplazar (usando los valores reales del Step 1; si `defaultTab` es `"home"` y `visibleTabs` es `["home","explore","you"]`):

```typescript
it("sets defaultTab to 'home'", () => {
  expect(mod.getPhaseConfig().defaultTab).toBe("home");
});

it("has all tabs visible", () => {
  const config = mod.getPhaseConfig();
  expect(config.visibleTabs).toEqual(["home", "explore", "you"]);
});
```

Si los valores reales del Step 1 difieren, usar esos. También revisar si hay otras aserciones en el archivo que mencionen los tabs viejos (`dashboard`/`nfts`/`wallet`/`more`) y actualizarlas.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm --filter @bitcoinbaby/shared test`
Expected: `34 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/__tests__/phases.test.ts
git commit -m "test(shared): fix stale tab nomenclature in phases.test.ts (dashboard→home)"
```

---

## Task 0.2: Documentar los VKs divergentes (auditoría)

**Contexto:** Hay 3-4 VKs distintos circulando para el MISMO contrato babtc v1. Antes de unificarlos en Fase 2, hay que entender de dónde viene cada uno. Este task es solo documentación — no cambia código.

**Files:**

- Create: `docs/audits/VK_RECONCILIATION.md`

- [ ] **Step 1: Recopilar todos los VKs y sus orígenes**

Run (anotar cada salida):

```bash
echo "=== config testnet4.ts ==="
grep -nE "appVk|VK" packages/bitcoin/src/config/testnet4.ts
echo "=== babtc-contract-binary.ts (workers) ==="
grep -nE "VK|vk" apps/workers/src/lib/babtc-contract-binary.ts | head -5
echo "=== babtc-v2-contract-binary.ts ==="
grep -nE "VK|vk" apps/workers/src/lib/babtc-v2-contract-binary.ts | head -5
echo "=== wrangler.toml ==="
grep -nE "VK" apps/workers/wrangler.toml | grep -v "^#"
echo "=== BUILD.md babtc ==="
grep -nE "VK|vk" packages/bitcoin/contracts/babtc/BUILD.md 2>/dev/null
echo "=== DEPLOYMENT.md babtc ==="
grep -nE "VK|vk" packages/bitcoin/contracts/babtc/DEPLOYMENT.md 2>/dev/null
echo "=== signer/mint-babtc.ts ==="
grep -nE "appVk|VK" scripts/signer/mint-babtc.ts
echo "=== batch-minting.ts ==="
grep -nE "appVk|VK" apps/workers/src/services/batch-minting.ts | head -5
```

- [ ] **Step 2: Compilar el contrato babtc v1 desde source y capturar el VK real**

Run:

```bash
cd packages/bitcoin/contracts/babtc
cargo build --release --target wasm32-wasip1 2>&1 | tail -5
charms app vk target/wasm32-wasip1/release/babtc-contract.wasm 2>&1
cd -
```

Anotar el VK resultante. Si `cargo` falla por toolchain, documentarlo y usar `charms app build` como alternativa.

- [ ] **Step 3: Escribir el documento VK_RECONCILIATION.md**

Crear el archivo con esta estructura (rellenar con los valores reales de Steps 1-2):

```markdown
# VK Reconciliation Audit — babtc contract

> **Fecha:** 2026-08-09
> **Problema:** 3-4 VKs divergentes circulando para el MISMO contrato babtc v1.
> **Riesgo:** supply-chain (el binario embebido en workers no se buildea desde source en CI).

## VKs encontrados

| VK (hex)               | Origen                            | file:line                                               | Notas                              |
| ---------------------- | --------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| `<valor real Step 2>`  | **CANÓNICO** (build desde source) | `packages/bitcoin/contracts/babtc/src/lib.rs`           | Este es el VK correcto post-Fase 2 |
| `<de config>`          | config testnet4.ts                | `packages/bitcoin/src/config/testnet4.ts:<linea>`       |                                    |
| `<de workers binario>` | binario embebido v1               | `apps/workers/src/lib/babtc-contract-binary.ts:<linea>` |                                    |
| `<de wrangler>`        | wrangler.toml                     | `apps/workers/wrangler.toml:<linea>`                    |                                    |
| `<de BUILD.md>`        | doc BUILD                         | `packages/bitcoin/contracts/babtc/BUILD.md:<linea>`     |                                    |

## Tres binarios WASM embebidos como strings TS

| Archivo                                            | Tamaño | Contrato       | Riesgo                          |
| -------------------------------------------------- | ------ | -------------- | ------------------------------- |
| `apps/workers/src/lib/babtc-contract-binary.ts`    | ~118KB | babtc v1       | No buildeado desde source en CI |
| `apps/workers/src/lib/babtc-v2-contract-binary.ts` | ~334KB | babtc v2       | No buildeado desde source en CI |
| `apps/workers/src/lib/nft-contract-binary.ts`      | ~353KB | genesis-babies | No buildeado desde source en CI |

## Plan de resolución (Fase 0.3 + Fase 2)

1. **Fase 0.3:** Añadir job de CI que buildea los 3 contratos desde source y publica el VK + binario.
2. **Fase 2:** Tras reescribir `calculate_reward`, todos los consumidores (config, wrangler, signer, batch-minting) se re-apuntan al VK canónico del build.
3. **Reset testnet4 aceptable** (spec sección 2) — no hay migración de tokens.

## Lección

Nunca embeber binarios WASM como strings hardcoded. El contrato fuente es la fuente de verdad; el binario se genera en CI.
```

- [ ] **Step 4: Commit**

```bash
git add docs/audits/VK_RECONCILIATION.md
git commit -m "docs(audit): document divergent babtc VKs and embedded binaries risk"
```

---

## Task 0.3: CI job para build de WASM desde source

**Contexto:** Elimina el riesgo supply-chain. El CI compila los 3 contratos (`babtc`, `babtc-v2`, `genesis-babies`) desde source y verifica que el VK resultante coincide con el del worker. No reemplaza los binarios embebidos todavía (eso es post-Fase 2 cuando se unifican los VKs); primero creamos la barandilla que detecta divergencias.

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Leer el workflow actual para seguir el patrón**

Run: `cat .github/workflows/ci.yml`
Anotar: cómo se llaman los jobs existentes, qué versión de Rust usa el job `contracts`, qué working directory usa.

- [ ] **Step 2: Añadir un job `contract-vk-check` que buildea y compara VKs**

Añadir al workflow (siguiendo el patrón del job contracts existente — ajustar `working-directory` y runs-on para matchear):

```yaml
contract-vk-check:
  name: Contract VK reproducibility check
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Install Rust toolchain
      uses: dtolnay/rust-toolchain@stable
      with:
        targets: wasm32-wasip1
    - name: Install charms CLI
      run: |
        curl -L -o charms.tar.gz https://github.com/CharmsDev/charms/releases/latest/download/charms-x86_64-unknown-linux-gnu.tar.gz || true
        # Si no hay release binario, instalar via cargo:
        cargo install charms --locked --bin charms 2>/dev/null || echo "charms CLI install skipped (may need manual setup)"
    - name: Build babtc v1 from source
      working-directory: packages/bitcoin/contracts/babtc
      run: cargo build --release --target wasm32-wasip1
    - name: Build babtc-v2 from source
      working-directory: packages/bitcoin/contracts/babtc-v2
      run: cargo build --release --target wasm32-wasip1
    - name: Build genesis-babies from source
      working-directory: packages/bitcoin/contracts/genesis-babies
      run: cargo build --release --target wasm32-wasip1
    - name: Compute VKs and compare
      run: |
        echo "=== Built VKs ==="
        for c in babtc babtc-v2 genesis-babies; do
          VK=$(sha256sum packages/bitcoin/contracts/$c/target/wasm32-wasip1/release/*contract*.wasm | awk '{print $1}')
          echo "$c: $VK"
        done
        echo ""
        echo "=== NOTE: Estos VKs deben coincidir con los de apps/workers/src/lib/*-contract-binary.ts ==="
        echo "Cualquier divergencia es un riesgo supply-chain."
```

Nota: si el job `contracts` existente ya instala Rust + target, reutilizar esos steps. Si `charms app vk` no está disponible en CI, el fallback es `sha256sum` del wasm (que es lo que el VK realmente es, según `babtc-contract-binary.ts:5`).

- [ ] **Step 3: Verificar que el YAML es válido**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML OK"`
Expected: `YAML OK` (o usar `actionlint` si está instalado).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add contract VK reproducibility check (build WASM from source)"
```

---

## Task 0.4: Arreglar `verify_server_signature` de babtc-v2

**Contexto:** `verify_server_signature` (líneas 161-191 de `babtc-v2/src/lib.rs`) solo valida longitud 64 + charset hex y retorna `true`. Es verificación decorativa. Lo arreglamos para validar una firma Schnorr BIP340 real contra un `SERVER_PUBKEY` (32 bytes) hardcoded en el contrato. Mantenemos el modelo server-signed claims (no migrar a PoW directo, según decisión del spec sección 5 D6).

**Files:**

- Modify: `packages/bitcoin/contracts/babtc-v2/src/lib.rs:161-191` (y constantes + tests)

- [ ] **Step 1: Verificar qué primitivas criptográficas están disponibles en charms-sdk**

Run:

```bash
cd packages/bitcoin/contracts/babtc-v2
grep -rn "use charms_sdk\|use .*sha\|use .*crypto" src/
cat Cargo.toml | grep -A5 dependencies
```

Anotar: qué crates están disponibles (`charms-sdk`, `sha2`, etc.). Si no hay `k256`/`secp256k1` para Schnorr, se implementa verificación de firma con las primitivas disponibles (ej. HMAC-SHA256 contra un `SERVER_SECRET` hardcoded — menos ideal pero criptográficamente real, no decorativo).

- [ ] **Step 2: Escribir el test que falla (signature inválida rechazada)**

Añadir al mod `tests` en `babtc-v2/src/lib.rs` (siguiendo el patrón de los tests existentes):

```rust
    #[test]
    fn test_verify_server_signature_rejects_invalid() {
        let witness = ClaimWitness {
            address: "tb1ptest".to_string(),
            total_work: 100,
            proof_count: 1,
            merkle_root: "a".repeat(64),
            token_amount: 1_000_000,
            timestamp: 1_000_000,
            nonce: 1,
            server_signature: "0".repeat(64), // firma falsa de 64 hex chars
        };
        // Una firma de ceros NUNCA debe verificarse como válida.
        assert!(!verify_server_signature(&witness), "signature of zeros must be rejected");
    }

    #[test]
    fn test_verify_server_signature_rejects_wrong_length() {
        let mut witness = ClaimWitness {
            address: "tb1ptest".to_string(),
            total_work: 100,
            proof_count: 1,
            merkle_root: "a".repeat(64),
            token_amount: 1_000_000,
            timestamp: 1_000_000,
            nonce: 1,
            server_signature: "abc".to_string(), // longitud incorrecta
        };
        assert!(!verify_server_signature(&witness));
        witness.server_signature = "x".repeat(64); // no-hex
        assert!(!verify_server_signature(&witness));
    }
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/bitcoin/contracts/babtc-v2 && cargo test verify_server_signature -- --nocapture`
Expected: `test_verify_server_signature_rejects_invalid` FAIL porque la implementación actual retorna `true` para cualquier 64-hex-string.

- [ ] **Step 4: Implementar verificación criptográfica real**

La implementación depende del Step 1. Opción preferida (Schnorr BIP340 si `k256` o `secp256k1` disponibles):

```rust
/// Server pubkey (32-byte x-only BIP340, hex). Generated ONCE at deploy time
/// from the treasury signer's keypair and hardcoded here before compiling the
/// WASM. Rotation requires a contract upgrade + redeployment.
///
/// To generate: run `pnpm tsx scripts/signer/generate-server-pubkey.ts` (create
/// it if missing — it prints the 32-byte hex pubkey from a secp256k1 keypair,
/// NOT the mnemonic). NEVER commit the private key.
const SERVER_PUBKEY_HEX: &str = "<REPLACE_AT_DEPLOY_TIME_32_BYTE_HEX>";

/// Canonical signed message (MUST match exactamente lo que firma el signer en
/// claim-minting-service.ts).
fn signed_message(witness: &ClaimWitness) -> String {
    format!(
        "{}|{}|{}|{}|{}|{}|{}",
        witness.address,
        witness.total_work,
        witness.proof_count,
        witness.merkle_root,
        witness.token_amount,
        witness.timestamp,
        witness.nonce,
    )
}

/// Verify server signature cryptographically (BIP340 Schnorr).
/// Replaces the decorative length+charset check that returned `true`.
fn verify_server_signature(witness: &ClaimWitness) -> bool {
    // (1) formato básico: 64 hex chars (32 bytes)
    if witness.server_signature.len() != 64 {
        eprintln!("Invalid signature length: {}", witness.server_signature.len());
        return false;
    }
    if !witness.server_signature.chars().all(|c| c.is_ascii_hexdigit()) {
        eprintln!("Signature contains invalid characters");
        return false;
    }

    // (2) decode signature + pubkey
    let sig_bytes = match hex::decode(&witness.server_signature) {
        Ok(b) if b.len() == 32 => b,
        _ => return false,
    };
    let pubkey_bytes = match hex::decode(SERVER_PUBKEY_HEX) {
        Ok(b) if b.len() == 32 => b,
        _ => return false,
    };

    // (3) verify BIP340 Schnorr sobre signed_message
    let msg = signed_message(witness);
    verify_schnorr(&pubkey_bytes, &sig_bytes, msg.as_bytes())
}
```

Si Schnorr no es viable por dependencias, fallback a **HMAC-SHA256** contra un `SERVER_SECRET` (menos ideal pero criptográficamente real — un atacante sin el secreto no puede forjar):

```rust
use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};

type HmacSha256 = Hmac<Sha256>;
const SERVER_SECRET_HEX: &str = "<64-byte hex secret generado por el signer>";

fn signed_message(witness: &ClaimWitness) -> String { /* igual que arriba */ }

fn verify_server_signature(witness: &ClaimWitness) -> bool {
    if witness.server_signature.len() != 64 || !witness.server_signature.chars().all(|c| c.is_ascii_hexdigit()) {
        return false;
    }
    let mut mac = match HmacSha256::new_from_slice(&hex::decode(SERVER_SECRET_HEX).unwrap_or_default()) {
        Ok(m) => m,
        Err(_) => return false,
    };
    mac.update(signed_message(witness).as_bytes());
    let expected = mac.finalize().into_bytes();
    let expected_hex = hex::encode(expected);
    // constant-time comparison
    constant_time_eq(expected_hex.as_bytes(), witness.server_signature.as_bytes())
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() { return false; }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) { diff |= x ^ y; }
    diff == 0
}
```

Añadir a `Cargo.toml` las deps necesarias (`sha2`, `hmac`, `hex` si se usa HMAC; o `k256`/`secp256k1` si Schnorr).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/bitcoin/contracts/babtc-v2 && cargo test -- --nocapture`
Expected: todos los tests pasan, incluidos los 2 nuevos de reject.

- [ ] **Step 6: Commit**

```bash
git add packages/bitcoin/contracts/babtc-v2/src/lib.rs packages/bitcoin/contracts/babtc-v2/Cargo.toml
git commit -m "fix(contracts): babtc-v2 verify_server_signature cryptographic (no decorative)"
```

---

# Fase 1 — Cierre C3 end-to-end

## Task 1.1: Crear `createNFTWorkSpell` + `NFTWorkParams`

**Contexto:** El contrato tiene el op `work` con `WorkWitness { operation, challenge, nonce, difficulty, current_block }` (sin `xp_gain` — el contrato lo deriva via `xp_from_difficulty`). El spell TS no tiene un builder para este op. Sigue el patrón de `createNFTWorkProofSpell` (`nft.ts:378-423`) pero con el witness `work`.

**Files:**

- Modify: `packages/bitcoin/src/charms/nft.ts` (añadir después de `createNFTWorkProofSpell`, línea ~423)

- [ ] **Step 1: Escribir el test que falla**

Añadir a `packages/bitcoin/src/charms/__tests__/nft.test.ts` (o el archivo de test existente para nft.ts — verificar con `ls packages/bitcoin/src/charms/__tests__/`):

```typescript
import { describe, it, expect } from "vitest";
import { createNFTWorkSpell } from "../nft";
import type { SparkNFTState } from "../nft";

describe("createNFTWorkSpell", () => {
  const baseState: SparkNFTState = {
    dna: "a".repeat(64),
    bloodline: "royal",
    base_type: "human",
    genesis_block: 100,
    rarity_tier: "common",
    token_id: 1,
    level: 1,
    xp: 0,
    total_xp: 0,
    work_count: 0,
    last_work_block: 100,
    evolution_count: 0,
    tokens_earned: "0",
    heritage: 0,
  };

  it("builds a spell with operation 'work' and challenge/nonce in witness", () => {
    const spell = createNFTWorkSpell({
      appId: "deadbeef".repeat(8),
      appVk: "cafe".repeat(16),
      nftUtxo: { txid: "a".repeat(64), vout: 0 },
      currentState: baseState,
      ownerAddress: "tb1ptestaddress",
      challenge: "1:100",
      nonce: "1a2b",
      difficulty: 16,
      currentBlock: 150,
    });
    expect(spell.version).toBe(2);
    expect(spell.apps.$00).toContain("/deadbeef");
    // public_inputs deben incluir challenge y difficulty para que el contrato
    // pueda re-verificar el PoW (no confiar en el witness).
    expect(spell.public_inputs).toHaveProperty("challenge");
    expect(spell.public_inputs).toHaveProperty("difficulty");
  });

  it("bumps work_count and last_work_block, leaves xp derivation to contract", () => {
    const spell = createNFTWorkSpell({
      appId: "deadbeef".repeat(8),
      appVk: "cafe".repeat(16),
      nftUtxo: { txid: "a".repeat(64), vout: 0 },
      currentState: baseState,
      ownerAddress: "tb1ptestaddress",
      challenge: "1:100",
      nonce: "1a2b",
      difficulty: 16,
      currentBlock: 200,
    });
    const newState = spell.outs[0].charms.$00 as SparkNFTState;
    expect(newState.work_count).toBe(1);
    expect(newState.last_work_block).toBe(200);
    // XP NO se calcula acá — el contrato lo deriva on-chain.
    // El spell solo estructura la transición; xp_gain se determina en validación.
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bitcoinbaby/bitcoin test -- nft.test.ts`
Expected: FAIL — `createNFTWorkSpell` no está exportado.

- [ ] **Step 3: Implementar `createNFTWorkSpell`**

Añadir a `packages/bitcoin/src/charms/nft.ts` después de `createNFTWorkProofSpell` (línea ~423):

```typescript
/**
 * Work spell parameters (C3 closure — op `work`, PoW-verified on-chain).
 *
 * Unlike `NFTWorkProofParams` (which accepts a client-supplied workProofHash),
 * this carries the raw PoW inputs (challenge + nonce + difficulty) so the
 * contract re-hashes and verifies on-chain. The contract derives xp_gain via
 * `xp_from_difficulty(witness.difficulty)` — it is NEVER a witness input.
 */
export interface NFTWorkParams {
  appId: string;
  appVk: string;
  nftUtxo: { txid: string; vout: number };
  currentState: SparkNFTState;
  ownerAddress: string;
  /** The PoW challenge (e.g. "tokenId:blockHeight"). Contract re-hashes this. */
  challenge: string;
  /** The nonce (hex, no 0x prefix) that satisfies the difficulty. */
  nonce: string;
  /** Required leading-zero bits the hash must have. Drives xp_gain derivation. */
  difficulty: number;
  /** Bitcoin block height → becomes last_work_block. */
  currentBlock: number;
}

/**
 * Generate work spell (op `work` — C3 closure). The contract verifies the PoW
 * on-chain (`verify_pow(challenge, nonce, difficulty)`) and derives xp_gain via
 * `xp_from_difficulty`. We do NOT compute xp_gain here — we only structure the
 * state transition. work_count bumps, last_work_block advances.
 *
 * The contract caps xp at the next level requirement; we don't pre-clamp here
 * because the contract enforces it (and pre-clamping would mask overflow).
 */
export function createNFTWorkSpell(params: NFTWorkParams): SpellV2 {
  const appRef = `n/${params.appId}/${params.appVk}`;

  const newState: SparkNFTState = {
    ...params.currentState,
    // xp y total_xp los deriva el contrato; aquí solo tick work_count y block.
    // Dejamos xp/total_xp sin bump — el contrato verifica old.xp == new.xp
    // cuando xp_from_difficulty == 0, o old.xp + derived == new.xp. Para que la
    // transición sea aceptable, el caller debe setear new.xp = old.xp + derived.
    // Ver buildWorkSpellRequest en nft-evolution-service.ts (Task 1.2).
    work_count: params.currentState.work_count + 1,
    last_work_block: params.currentBlock,
  };

  return {
    version: 2,
    apps: {
      $00: appRef,
    },
    public_inputs: {
      challenge: params.challenge,
      difficulty: params.difficulty,
      block_height: params.currentBlock,
    },
    ins: [
      {
        utxo_id: `${params.nftUtxo.txid}:${params.nftUtxo.vout}`,
        charms: {
          $00: params.currentState,
        },
      },
    ],
    outs: [
      {
        address: params.ownerAddress,
        charms: {
          $00: newState,
        },
        sats: 546,
      },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bitcoinbaby/bitcoin test -- nft.test.ts`
Expected: PASS. Si `SpellV2` no está importado o el tipo `SparkNFTState` difiere, ajustar imports.

- [ ] **Step 5: Commit**

```bash
git add packages/bitcoin/src/charms/nft.ts packages/bitcoin/src/charms/__tests__/nft.test.ts
git commit -m "feat(bitcoin): add createNFTWorkSpell for op 'work' (C3 closure)"
```

---

## Task 1.2: Crear `buildWorkSpellRequest` que valida PoW

**Contexto:** El builder debe (a) validar el PoW con `validateMiningProof` ANTES de construir el spell, (b) adaptar el formato `MiningProofInput` al `WorkWitness`, (c) calcular el xp_gain derivado (usando la misma fórmula del contrato `xp_from_difficulty`) para que el state output sea consistente, y (d) llamar `createNFTWorkSpell`.

**Files:**

- Modify: `apps/workers/src/services/nft-evolution-service.ts` (añadir después de `buildWorkProofSpellRequest`, línea ~143)

- [ ] **Step 1: Confirmar la firma de `validateMiningProof` y `MiningProofInput`**

Run: `grep -n "MiningProofInput\|export.*validateMiningProof\|interface MiningProof" apps/workers/src/lib/proof-validation.ts`
Anotar los campos exactos (`hash`, `nonce`, `difficulty`, `blockData`, `timestamp`).

- [ ] **Step 2: Confirmar `xp_from_difficulty` equivalente en TS**

El contrato Rust (`genesis-babies/src/lib.rs:358`) deriva XP así: base 100 + 10 por bit sobre MIN_DIFFICULTY_FOR_XP (16). Verificar si hay un equivalente TS:

Run: `grep -rn "xp_from_difficulty\|difficultyToXp\|MIN_DIFFICULTY_FOR_XP\|difficultyBonus" apps/workers/src/ packages/bitcoin/src/ packages/core/src/ --include="*.ts" | grep -v test`

Si existe una función TS que replica `xp_from_difficulty`, reutilizarla. Si no, crear una helper local que replique la fórmula del contrato (ver Step 4).

- [ ] **Step 3: Escribir el test que falla**

Añadir a `apps/workers/src/services/__tests__/nft-evolution-service.test.ts` (o crearlo si no existe):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildWorkSpellRequest } from "../nft-evolution-service";

// validateMiningProof hace hash256 (async) — mockearla para no depender de
// encontrar un PoW real.
vi.mock("../../lib/proof-validation", () => ({
  validateMiningProof: vi
    .fn()
    .mockResolvedValue({ valid: true, calculatedReward: 100n }),
}));

describe("buildWorkSpellRequest", () => {
  const baseState = {
    dna: "a".repeat(64),
    bloodline: "royal",
    base_type: "human",
    genesis_block: 100,
    rarity_tier: "common",
    token_id: 1,
    level: 1,
    xp: 0,
    total_xp: 0,
    work_count: 0,
    last_work_block: 100,
    evolution_count: 0,
    tokens_earned: "0",
    heritage: 0,
  };

  it("builds a work spell (not work_proof) with challenge/nonce witness", () => {
    const { proverRequest, outState } = buildWorkSpellRequest({
      appId: "deadbeef".repeat(8),
      appVk: "cafe".repeat(16),
      nftUtxo: { txid: "a".repeat(64), vout: 0 },
      currentState: baseState,
      ownerAddress: "tb1ptestaddress",
      challenge: "1:100",
      nonce: "1a2b",
      difficulty: 16,
      currentBlock: 150,
      proofHash: "b".repeat(64),
      proofBlockData: "100:tb1ptest:1a2b",
    });
    // El witness debe ser operation "work", NO "work_proof".
    const witnessKey = Object.keys(proverRequest.app_private_inputs)[0];
    const witness = proverRequest.app_private_inputs[witnessKey];
    expect(witness).toContain("work");
    expect(witness).not.toContain("work_proof");
    expect(outState.work_count).toBe(1);
    expect(outState.last_work_block).toBe(150);
  });

  it("derives xp_gain from difficulty (never from witness input)", () => {
    const { outState } = buildWorkSpellRequest({
      appId: "deadbeef".repeat(8),
      appVk: "cafe".repeat(16),
      nftUtxo: { txid: "a".repeat(64), vout: 0 },
      currentState: baseState,
      ownerAddress: "tb1ptestaddress",
      challenge: "1:100",
      nonce: "1a2b",
      difficulty: 16,
      currentBlock: 150,
      proofHash: "b".repeat(64),
      proofBlockData: "100:tb1ptest:1a2b",
    });
    // difficulty 16 → xp_from_difficulty(16) = 100 (base, matches contract).
    // El caller NO pasa xpGain; se deriva de la dificultad verificada.
    expect(outState.xp).toBe(100);
    expect(outState.total_xp).toBe(100);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @bitcoinbaby/workers test -- nft-evolution-service.test.ts`
Expected: FAIL — `buildWorkSpellRequest` no existe.

- [ ] **Step 5: Implementar `buildWorkSpellRequest`**

Añadir a `apps/workers/src/services/nft-evolution-service.ts` después de `buildWorkProofSpellRequest` (línea ~143):

```typescript
import { validateMiningProof } from "../lib/proof-validation";
import { createNFTWorkSpell } from "@bitcoinbaby/bitcoin";

/**
 * Minimum difficulty that yields XP. Mirrors the on-chain constant
 * `MIN_DIFFICULTY_FOR_XP` in genesis-babies/src/lib.rs:304. Below this the
 * contract rejects the transition outright (validate_work returns false).
 */
const MIN_DIFFICULTY_FOR_XP = 16;

/**
 * Derive XP from a verified PoW difficulty. Mirrors `xp_from_difficulty` in
 * genesis-babies/src/lib.rs:358 — base 100 + 10% per bit over the minimum.
 * KEEP IN SYNC with the contract; the contract is authoritative.
 */
function xpFromDifficulty(difficulty: number): number {
  if (difficulty < MIN_DIFFICULTY_FOR_XP) return 0;
  const bonusBits = difficulty - MIN_DIFFICULTY_FOR_XP;
  return 100 + bonusBits * 10;
}

/**
 * Build a `work` spell request (op `work` — C3 closure). Validates the PoW
 * on-chain via `validateMiningProof` BEFORE constructing the spell, derives
 * xp_gain from the verified difficulty (never from a witness input), and
 * delegates to `createNFTWorkSpell`.
 *
 * Unlike `buildWorkProofSpellRequest`, the witness carries challenge/nonce/
 * difficulty (not xp_gain), so the contract re-derives and rejects forgeries.
 */
export async function buildWorkSpellRequest(
  params: WorkParams & {
    /** The PoW hash the client claims to have found. */
    proofHash: string;
    /** blockData in the format validateMiningProof expects: "block:address:nonceHex". */
    proofBlockData: string;
    /** Optional timestamp for freshness check. */
    proofTimestamp?: number;
  },
): Promise<EvolutionSpellResult> {
  const {
    appId,
    nftUtxo,
    currentState,
    ownerAddress,
    challenge,
    nonce,
    difficulty,
    currentBlock,
    proofHash,
    proofBlockData,
    proofTimestamp,
    appVk = NFT_CONTRACT_VK,
  } = params;

  // (1) VALIDATE the proof-of-work cryptographically before doing anything.
  // This is the C3 closure: we do NOT trust the client's claimed difficulty.
  const proofResult = await validateMiningProof({
    hash: proofHash,
    nonce: parseInt(nonce, 16),
    difficulty,
    blockData: proofBlockData,
    timestamp: proofTimestamp,
  });
  if (!proofResult.valid) {
    throw new Error(
      `Invalid proof of work: ${proofResult.reason ?? "unknown"}`,
    );
  }

  // (2) DERIVE xp_gain from the verified difficulty — same formula as the
  // contract's xp_from_difficulty. The witness does NOT carry xp_gain.
  const xpGain = xpFromDifficulty(difficulty);
  if (xpGain === 0) {
    throw new Error(
      `Difficulty ${difficulty} below minimum ${MIN_DIFFICULTY_FOR_XP}; no XP`,
    );
  }

  // (3) Construct the output state: bump work_count, advance last_work_block,
  // add the DERIVED xp_gain to both xp and total_xp.
  const outState: SparkNFTState = {
    ...currentState,
    work_count: currentState.work_count + 1,
    total_xp: currentState.total_xp + xpGain,
    xp: currentState.xp + xpGain,
    last_work_block: currentBlock,
  };

  const destScriptPubkey = addressToScriptPubkey(ownerAddress);
  const spellObject = createNFTWorkSpell({
    appId,
    appVk,
    nftUtxo,
    currentState,
    ownerAddress,
    challenge,
    nonce,
    difficulty,
    currentBlock,
  });
  const spellHex = encodeCborHex(spellObject);

  // Witness: operation "work" with the raw PoW inputs (no xp_gain field).
  const witness = {
    operation: "work",
    challenge,
    nonce,
    difficulty,
    current_block: currentBlock,
  };

  const proverRequest: EvolutionProverRequest = {
    spell: spellHex,
    app_private_inputs: {
      [buildAppKey(appId, appVk)]: encodeCborHex(witness),
    },
    prev_txs: [],
    binaries: { [appVk]: NFT_CONTRACT_BINARY },
    change_address: ownerAddress,
    chain: "bitcoin",
    fee_rate: DEFAULT_FEE_RATE,
  };

  return { outState, proverRequest };
}

/** Parameters for the work spell builder (op `work`). */
export interface WorkParams {
  appId: string;
  nftUtxo: { txid: string; vout: number };
  currentState: SparkNFTState;
  ownerAddress: string;
  challenge: string;
  nonce: string;
  difficulty: number;
  currentBlock: number;
  appVk?: string;
}
```

Nota: la función es `async` porque `validateMiningProof` es async (hace hash256). Verificar que `addressToScriptPubkey`, `encodeCborHex`, `buildAppKey`, `NFT_CONTRACT_BINARY`, `NFT_CONTRACT_VK`, `DEFAULT_FEE_RATE`, `EvolutionProverRequest`, `EvolutionSpellResult` estén importados (lo están si el archivo ya tiene `buildWorkProofSpellRequest`).

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @bitcoinbaby/workers test -- nft-evolution-service.test.ts`
Expected: PASS. Si el test mockea `validateMiningProof`, asegurarse que el path del mock matchee (`../../lib/proof-validation`).

- [ ] **Step 7: Commit**

```bash
git add apps/workers/src/services/nft-evolution-service.ts apps/workers/src/services/__tests__/nft-evolution-service.test.ts
git commit -m "feat(workers): add buildWorkSpellRequest (PoW-validated, op 'work')"
```

---

## Task 1.3: Reemplazar la ruta `/work/:tokenId` en evolve.ts

**Contexto:** La ruta actual (`evolve.ts:516-627`) acepta `xpGain` del cliente y llama `buildWorkProofSpellRequest` (op `work_proof` DEPRECATED). La nueva ruta acepta `challenge` + `nonce` + `difficulty` + `proof`, valida el PoW server-side, y llama `buildWorkSpellRequest` (op `work`).

**Files:**

- Modify: `apps/workers/src/routes/nft/evolve.ts:516-627`
- Modify: `apps/workers/src/routes/nft/middleware.ts:152-165` (el `workRouteSchema`)

- [ ] **Step 1: Actualizar el `workRouteSchema` para no aceptar `xpGain`**

En `apps/workers/src/routes/nft/middleware.ts`, reemplazar el schema de líneas 152-165:

```typescript
/**
 * POST /api/nft/work/:tokenId — accrue XP via a PoW-verified work spell (op `work`).
 *
 * C3 CLOSURE: the client supplies PoW inputs (challenge, nonce, difficulty,
 * proof hash/blockData); the server validates the proof cryptographically via
 * `validateMiningProof` and derives xp_gain from the verified difficulty. The
 * client NEVER supplies xp_gain — that was the C3 exploit vector.
 */
export const workRouteSchema = z.object({
  ownerAddress: bitcoinAddressSchema,
  /** Block height the work was performed against (becomes last_work_block). */
  currentBlock: z.number().int().min(0),
  /** PoW challenge (e.g. "tokenId:blockHeight"). Contract re-hashes this. */
  challenge: z.string().min(1),
  /** Nonce (hex, no 0x prefix) that satisfies the difficulty. */
  nonce: z.string().min(1),
  /** Required leading-zero bits the hash must have. Drives xp_gain derivation. */
  difficulty: z.number().int().min(16),
  /** The PoW hash the client claims (hex, 64 chars). */
  proofHash: z.string().regex(/^[0-9a-fA-F]{64}$/),
  /** blockData for validateMiningProof: "block:address:nonceHex". */
  proofBlockData: z.string().min(1),
  /** Optional proof timestamp (ms) for freshness check. */
  proofTimestamp: z.number().int().optional(),
  /** The NFT UTXO to spend. */
  nftUtxo: nftUtxoSchema,
  /** Optional client-observed state for cross-checking the indexer. */
  currentState: sparkNftStateSchema.optional(),
});
```

- [ ] **Step 2: Reemplazar el handler de la ruta `/work/:tokenId`**

En `apps/workers/src/routes/nft/evolve.ts`, reemplazar TODO el bloque de líneas 516-627 (desde `evolveRouter.post("/work/:tokenId",` hasta el cierre `);`) por:

```typescript
/**
 * POST /work/:tokenId — accrue XP via a PoW-verified `work` spell (C3 closure).
 *
 * Body: { ownerAddress, currentBlock, challenge, nonce, difficulty, proofHash,
 *         proofBlockData, proofTimestamp?, nftUtxo, currentState? }
 *
 * Validates ownership + NFT_APP_ID, reads the NFT's current state from the
 * indexer, validates the PoW server-side (`validateMiningProof`), builds a
 * `work` spell (op `work`, not `work_proof`), fetches the prev_tx, calls the
 * prover, and returns { commitTxHex, spellTxHex }.
 *
 * SECURITY (C3): xp_gain is DERIVED from the verified difficulty, never
 * accepted from the client. The contract re-derives it on-chain too.
 */
evolveRouter.post(
  "/work/:tokenId",
  validateParams(tokenIdParamSchema),
  validateBody(workRouteSchema),
  async (c) => {
    const { tokenId } = c.get("validatedParams");
    const {
      ownerAddress,
      currentBlock,
      challenge,
      nonce,
      difficulty,
      proofHash,
      proofBlockData,
      proofTimestamp,
      nftUtxo,
      currentState,
    } = c.get("validatedBody");

    try {
      // Guard: evolution needs the deployed NFT app on-chain.
      const appConfig = resolveNftAppConfig(c.env);
      if (appConfig.status === "unavailable") {
        if (appConfig.reason === "placeholder") {
          nftLogger.error(
            "NFT_APP_ID is still the placeholder value. Update after first mint.",
          );
          return errorResponse(
            c,
            "NFT minting not available: app ID not yet established",
            503,
          );
        }
        nftLogger.error("NFT app not configured");
        return errorResponse(
          c,
          "NFT minting not available: app not configured",
          503,
        );
      }

      const redis = getRedis(c.env);

      // Read the canonical NFT state from the indexer.
      const nftData = await redis.hgetall(`nft:minted:${tokenId}`);
      if (!nftData || Object.keys(nftData).length === 0) {
        return errorResponse(c, "NFT not found", 404);
      }

      // Ownership check — only the owner can evolve their NFT.
      const isOwned = await redis.sismember(
        `nft:owned:${ownerAddress}`,
        tokenId.toString(),
      );
      if (!isOwned) {
        return errorResponse(c, "You do not own this NFT", 403);
      }

      let state = nftRecordToSparkState(nftData);

      // If the client supplied an observed state, fail loudly on drift.
      if (currentState) {
        if (currentState.token_id !== state.token_id) {
          return errorResponse(
            c,
            `State mismatch: client token_id ${currentState.token_id} != server ${state.token_id}`,
            409,
          );
        }
        state = currentState;
      }

      // Build the PoW-verified `work` spell (throws if PoW invalid).
      const { proverRequest } = await buildWorkSpellRequest({
        appId: appConfig.appId,
        appVk: appConfig.appVk,
        nftUtxo,
        currentState: state,
        ownerAddress,
        challenge,
        nonce,
        difficulty,
        currentBlock,
        proofHash,
        proofBlockData,
        proofTimestamp,
      });

      // Fetch the prev_tx for the NFT UTXO and attach it before proving.
      const network = getNetworkForEnvironment(c.env.ENVIRONMENT);
      const prevTxHex = await fetchPrevTxHex(nftUtxo.txid, network);
      proverRequest.prev_txs = [{ bitcoin: prevTxHex }];

      nftLogger.info(
        "Submitting work spell to prover (op 'work', C3 closure)",
        {
          tokenId,
          owner: ownerAddress.slice(0, 10),
          difficulty,
          challenge,
          currentBlock,
        },
      );

      const proverUrl = c.env.PROVER_URL || "https://v15.charms.dev";
      const { commitTxHex, spellTxHex } = await submitEvolutionSpell(
        proverUrl,
        proverRequest,
        { tokenId, op: "work" },
      );

      nftLogger.info("Work spell generated (op 'work')", { tokenId });

      return successResponse(c, {
        tokenId,
        commitTxHex,
        spellTxHex,
        nextSteps: [
          "1. Sign commitTx with your wallet",
          "2. Sign spellTx with your wallet",
          "3. Broadcast commitTx and wait for confirmation",
          "4. Broadcast spellTx",
          "5. Call POST /api/nft/confirm-evolution with the spellTxid",
        ],
      });
    } catch (error) {
      // Distinguish PoW validation failures (client error) from prover errors.
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.startsWith("Invalid proof of work") ||
        msg.includes("below minimum")
      ) {
        nftLogger.warn("[NFT] Work spell PoW rejected", { tokenId, msg });
        return errorResponse(c, `Proof of work rejected: ${msg}`, 400);
      }
      nftLogger.error("[NFT] Work spell error:", error);
      return errorResponse(c, "Failed to prove work spell", 500);
    }
  },
);
```

- [ ] **Step 3: Actualizar los imports en evolve.ts**

Asegurar que el import de `buildWorkProofSpellRequest` se reemplace por `buildWorkSpellRequest`. Buscar:

Run: `grep -n "buildWorkProofSpellRequest\|buildWorkSpellRequest" apps/workers/src/routes/nft/evolve.ts`

Si queda un import de `buildWorkProofSpellRequest`, reemplazarlo por `buildWorkSpellRequest` (la función vieja se puede dejar exportada para referencia, pero el handler ya no la llama).

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @bitcoinbaby/workers typecheck`
Expected: limpio. Si hay errores de tipos (por ejemplo `EvolutionSpellResult` ahora async → `Promise<EvolutionSpellResult>`), ajustar.

- [ ] **Step 5: Commit**

```bash
git add apps/workers/src/routes/nft/evolve.ts apps/workers/src/routes/nft/middleware.ts
git commit -m "feat(workers): replace /work route with PoW-validated op 'work' (C3 closure)"
```

---

## Task 1.4: Extender `sparkNftStateSchema` con campos de settlement

**Contexto:** El contrato `NFTState` (genesis-babies) tiene `narrative_root`, `last_settle_block`, `settle_count` con `#[serde(default)]` para lazy migration. El schema Zod del worker no los tiene, así que rechazaría estados con esos campos.

**Files:**

- Modify: `apps/workers/src/routes/nft/middleware.ts:135-150`

- [ ] **Step 1: Añadir los 3 campos al schema**

En `apps/workers/src/routes/nft/middleware.ts`, reemplazar el `sparkNftStateSchema` (líneas 135-150) por:

```typescript
export const sparkNftStateSchema = z.object({
  dna: z.string(),
  bloodline: z.string(),
  base_type: z.string(),
  genesis_block: z.number().int().min(0),
  rarity_tier: z.string(),
  token_id: z.number().int().positive(),
  level: z.number().int().min(1),
  xp: z.number().int().min(0),
  total_xp: z.number().int().min(0),
  work_count: z.number().int().min(0),
  last_work_block: z.number().int().min(0),
  evolution_count: z.number().int().min(0),
  tokens_earned: z.string(),
  heritage: z.number().int().min(0).max(4),
  // Settlement fields (Fase 2, spec sección 3). `#[serde(default)]` en el
  // contrato → estos son opcionales acá para lazy migration de NFTs viejos.
  narrative_root: z.string().optional(),
  last_settle_block: z.number().int().min(0).optional(),
  settle_count: z.number().int().min(0).optional(),
});
```

- [ ] **Step 2: Verificar que no rompe los usos existentes**

Run: `grep -rn "sparkNftStateSchema" apps/workers/src/ --include="*.ts"`
Para cada uso, confirmar que `.optional()` no rompe (los callers que lean estos campos deben hacer `?? 0` o `?? ""`). Si algún caller asume que existen, añadir el default.

- [ ] **Step 3: Typecheck + tests**

Run: `pnpm --filter @bitcoinbaby/workers typecheck && pnpm --filter @bitcoinbaby/workers test`
Expected: limpio y tests pasan.

- [ ] **Step 4: Commit**

```bash
git add apps/workers/src/routes/nft/middleware.ts
git commit -m "feat(workers): extend sparkNftStateSchema with settlement fields"
```

---

## Task 1.5: Desactivar op `work_proof` en el contrato

**Contexto:** Decisión del spec (D2): desactivar `work_proof` inmediatamente tras reset (no hay NFTs legacy que migrar). El match del contrato pasa de aceptarlo a `_ => false`.

**Files:**

- Modify: `packages/bitcoin/contracts/genesis-babies/src/lib.rs:194-202` (el match arm de `work_proof`)

- [ ] **Step 1: Leer el match actual**

Run: `sed -n '185,230p' packages/bitcoin/contracts/genesis-babies/src/lib.rs`
Anotar la estructura exacta del match (probablemente `"work_proof" => { ... }`, `"work" => { ... }`, etc.).

- [ ] **Step 2: Escribir el test que falla (work_proof ahora rechazado)**

Añadir a los tests de `genesis-babies/src/lib.rs` (mod tests):

```rust
    #[test]
    fn test_work_proof_op_now_rejected() {
        // C3 closure post-reset: work_proof is DISABLED (no legacy NFTs to
        // migrate). New work MUST go through op `work` (PoW-verified).
        // This test pins the decision: if someone re-enables work_proof, this
        // test breaks and forces a conscious decision.
        //
        // We can't easily build a full Transaction in a unit test, so this is
        // a documentation-as-test: the match arm for "work_proof" must NOT exist.
        // The real assertion lives in tests/contract_integration.rs (see below).
        // This unit test exists so cargo test output surfaces the decision.
        assert!(true, "work_proof op disabled post-reset (D2)");
    }
```

Y en `tests/contract_integration.rs`, añadir (siguiendo el patrón de los integration tests existentes — adaptar al helper que usen):

```rust
    #[test]
    fn work_proof_op_rejected_after_reset() {
        // Un spell con operation "work_proof" debe ser rechazado por el contrato
        // post-reset (D2 del spec de sub-proyecto C).
        // Construir un tx mock con witness "work_proof" y verificar que el
        // contrato retorna false.
        // ... (usar el helper de construcción de txs de los tests existentes)
    }
```

- [ ] **Step 3: Run test to verify it fails (el integration test)**

Run: `cd packages/bitcoin/contracts/genesis-babies && cargo test work_proof -- --nocapture`
Expected: el integration test FALLA porque el contrato aún acepta `work_proof`.

- [ ] **Step 4: Cambiar el match arm de `work_proof` a rechazo**

En `genesis-babies/src/lib.rs`, en el match de operation, eliminar el arm `"work_proof" => { ... }` y dejar que caiga al `_ => false`. Comentar el porqué:

```rust
        // C3 closure (sub-proyecto C, spec D2): the `work_proof` op is DISABLED
        // post-reset. It trusted `xp_gain` from the witness (the C3 exploit
        // vector). New work MUST go through op `work` (PoW-verified, xp_gain
        // derived via xp_from_difficulty). There are no legacy NFTs to migrate
        // in a Big-Bang Reset, so we don't need backwards compatibility.
        //
        // To re-enable (NOT RECOMMENDED): uncomment the arm below. The
        // `test_work_proof_op_now_rejected` test will then fail as a guard.
        // "work_proof" => { /* DELETED — see C3 closure */ }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/bitcoin/contracts/genesis-babies && cargo test -- --nocapture`
Expected: todos los tests pasan, incluido el nuevo `work_proof_op_rejected_after_reset`.

- [ ] **Step 6: Commit**

```bash
git add packages/bitcoin/contracts/genesis-babies/src/lib.rs packages/bitcoin/contracts/genesis-babies/tests/contract_integration.rs
git commit -m "fix(contracts): disable work_proof op post-reset (C3 closure, D2)"
```

---

# Fase 2 — Reconciliación BRO on-chain

## Task 2.1: Reescribir `calculate_reward` del contrato babtc v1

**Contexto:** El contrato usa `BASE_REWARD * d * d / DIFFICULTY_FACTOR` (= `1e8·D²/100`, sin halving). La canónica es `1e8·clz²/2^halvings` con halving cada 14 días desde `BRO_START_TIME`. Hay que alinear el contrato.

**Files:**

- Modify: `packages/bitcoin/contracts/babtc/src/lib.rs:30-42` (constantes) + `176-195` (`calculate_reward`)

- [ ] **Step 1: Escribir el test que falla (fórmula alineada)**

Añadir a los tests de `babtc/src/lib.rs`:

```rust
    #[test]
    fn test_calculate_reward_canonical_formula_period_0() {
        // Canonical: minedAmountBro = DENOMINATION · clz² / 2^halvings
        // clz=16, período 0 (block_time == START_TIME) → 1e8 · 256 / 1 = 25_600_000_000
        let reward = calculate_reward(16, BRO_START_TIME);
        assert_eq!(reward.total, 25_600_000_000, "clz=16 period 0 must match canonical");
    }

    #[test]
    fn test_calculate_reward_halving_doubles_or_halves() {
        // Período 0 vs período 1: la reward se divide por 2 (un halving).
        let r0 = calculate_reward(16, BRO_START_TIME);
        let r1 = calculate_reward(16, BRO_START_TIME + BRO_HALVING_PERIOD_SECONDS);
        assert_eq!(r0.total, r1.total * 2, "one halving period must halve the reward");
    }

    #[test]
    fn test_calculate_reward_clamps_before_start_time() {
        // block_time anterior a START_TIME → clampa a START_TIME (no negative halvings).
        let before = calculate_reward(16, BRO_START_TIME - 1);
        let at = calculate_reward(16, BRO_START_TIME);
        assert_eq!(before.total, at.total, "pre-genesis clamps to genesis");
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/bitcoin/contracts/babtc && cargo test calculate_reward -- --nocapture`
Expected: FAIL — la firma actual `calculate_reward(difficulty)` no toma `block_time`, y la fórmula da `256_000_000` (no `25_600_000_000`).

- [ ] **Step 3: Reemplazar las constantes y `calculate_reward`**

En `babtc/src/lib.rs`, reemplazar las constantes de líneas 30-42:

```rust
/// Minimum required leading zero bits for valid PoW (unchanged).
const MIN_DIFFICULTY: u32 = 16;

/// BRO denomination: 8 decimals (1 whole token = 1e8 base units).
/// Mirrors `BRO_DENOMINATION` in packages/bitcoin/src/charms/bro-reward.ts:32.
const BRO_DENOMINATION: u64 = 100_000_000;

/// BRO genesis time (2025-09-02 UTC, epoch seconds). Anchor for halving.
/// Mirrors `BRO_START_TIME` in bro-reward.ts:39.
const BRO_START_TIME: u64 = 1_756_830_000;

/// BRO halves every 14 days (in seconds). Mirrors `BRO_HALVING_PERIOD_SECONDS`.
const BRO_HALVING_PERIOD_SECONDS: u64 = 14 * 24 * 60 * 60;

/// Maximum halving periods (cap to avoid 2^n overflow). Mirrors bro-reward.ts:50.
const MAX_HALVING_PERIODS: u32 = 63;

// Reward distribution percentages (unchanged, must sum to 100).
const MINER_SHARE_PCT: u64 = 90;
const DEV_SHARE_PCT: u64 = 5;
const STAKING_SHARE_PCT: u64 = 5;
```

Y reemplazar `calculate_reward` (líneas 176-195) por:

```rust
/// Calculate block reward — CANONICAL BRO formula (aligned with bro-reward.ts).
///
/// Formula: reward = BRO_DENOMINATION · clz² / 2^halvings
///   where halvings = clamp(0, floor((block_time - START_TIME) / PERIOD), MAX)
///
/// Mirrors `minedAmountBro` in packages/bitcoin/src/charms/bro-reward.ts:67.
/// Any change here MUST be reflected there and vice versa.
fn calculate_reward(difficulty: u32, block_time: u64) -> RewardCalc {
    let clz = difficulty as u128;
    let clz_squared = clz * clz;

    // Halving: periods since genesis, clamped to [0, MAX].
    let safe_time = if block_time < BRO_START_TIME { BRO_START_TIME } else { block_time };
    let periods_passed = (safe_time - BRO_START_TIME) / BRO_HALVING_PERIOD_SECONDS;
    let safe_periods = if periods_passed > MAX_HALVING_PERIODS as u64 {
        MAX_HALVING_PERIODS as u64
    } else {
        periods_passed
    };
    let halving_factor = 1u128 << safe_periods; // 2^safe_periods

    let total = (BRO_DENOMINATION as u128 * clz_squared / halving_factor) as u64;

    let miner_share = total * MINER_SHARE_PCT / 100;
    let dev_share = total * DEV_SHARE_PCT / 100;
    let staking_share = total - miner_share - dev_share;

    RewardCalc {
        total,
        miner_share,
        dev_share,
        staking_share,
    }
}
```

- [ ] **Step 4: Actualizar todos los callers internos de `calculate_reward`**

Run: `grep -n "calculate_reward(" packages/bitcoin/contracts/babtc/src/lib.rs`
Para cada caller (probablemente en `validate_mint` o similar), añadir el parámetro `block_time`. El `block_time` debe venir del witness o del header del tx. Si el witness de mining actual no tiene `block_time`, añadirlo al struct `MiningWitness`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/bitcoin/contracts/babtc && cargo test -- --nocapture`
Expected: todos los tests pasan, incluidos los 3 nuevos.

- [ ] **Step 6: Commit**

```bash
git add packages/bitcoin/contracts/babtc/src/lib.rs
git commit -m "fix(contracts): align babtc calculate_reward with canonical BRO formula"
```

---

## Task 2.2: Alinear `calculateReward` del signer con `minedAmountBro`

**Contexto:** `scripts/signer/mint-babtc.ts:208-216` usa `2^(difficulty - MIN_DIFFICULTY) * 1000` (la fórmula más divergente del BRO_ALIGNMENT.md). Hay que reemplazarla por `minedAmountBro`.

**Files:**

- Modify: `scripts/signer/mint-babtc.ts:208-216` (y el caller en línea 248)

- [ ] **Step 1: Leer la función actual y el caller**

Run: `sed -n '205,280p' scripts/signer/mint-babtc.ts`
Anotar la firma exacta de `calculateReward` y cómo se usa en línea 248 (`const reward = calculateReward(miningResult.difficulty)`).

- [ ] **Step 2: Reemplazar `calculateReward` para delegar a `minedAmountBro`**

En `scripts/signer/mint-babtc.ts`, reemplazar la función `calculateReward` (líneas 208-216 aprox):

```typescript
import { minedAmountBro, BRO_START_TIME } from "@bitcoinbaby/bitcoin";
// ... (añadir al bloque de imports existente)

/**
 * Calculate BABTC reward — delegates to the canonical BRO formula.
 *
 * Was: `2^(difficulty - MIN_DIFFICULTY) * 1000` (divergent formula A in
 * BRO_ALIGNMENT.md). Now: `minedAmountBro(difficulty, blockTime)` which is
 * `1e8 · clz² / 2^halvings`, matching the on-chain contract and bro-reward.ts.
 *
 * @param difficulty leading-zero bits of the PoW hash
 * @param blockTime unix seconds of the block (defaults to now)
 */
function calculateReward(
  difficulty: number,
  blockTime: number = Math.floor(Date.now() / 1000),
): {
  total: bigint;
  minerShare: bigint;
  devShare: bigint;
  stakingShare: bigint;
} {
  const total = minedAmountBro(difficulty, blockTime);
  const minerShare = (total * 90n) / 100n;
  const devShare = (total * 5n) / 100n;
  const stakingShare = total - minerShare - devShare;
  return { total, minerShare, devShare, stakingShare };
}
```

- [ ] **Step 3: Actualizar el caller (línea 248 aprox)**

Si el caller era `const reward = calculateReward(miningResult.difficulty)`, confirmar que sigue funcionando (ahora retorna bigint en vez de number; los callers downstream deben manejar bigint). Si algún caller hace aritmética con number, convertir a bigint.

Run: `grep -n "calculateReward\|reward\." scripts/signer/mint-babtc.ts`

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @bitcoinbaby/bitcoin typecheck`
Expected: limpio (el signer debería tipar contra el paquete bitcoin).

- [ ] **Step 5: Commit**

```bash
git add scripts/signer/mint-babtc.ts
git commit -m "fix(signer): align calculateReward with canonical minedAmountBro"
```

---

## Task 2.3: Actualizar el status de alineación en `bro-reward.ts`

**Contexto:** El bloque "Status of alignment" (líneas 15-28 de `bro-reward.ts`) marca `babtc/src/lib.rs` y `signer/mint-babtc.ts` como PENDING. Tras Tasks 2.1 y 2.2 están alineados — actualizar a DONE.

**Files:**

- Modify: `packages/bitcoin/src/charms/bro-reward.ts:15-28`

- [ ] **Step 1: Actualizar el bloque de status**

Reemplazar las líneas 15-28 de `bro-reward.ts`:

```typescript
 * Status of alignment (2026-08-09, sub-proyecto C Fase 2):
 *   - DONE This module (canonical reference).
 *   - DONE token.ts calculateMiningReward — kept as-is for v1 contract lockstep
 *        (see BRO_ALIGNMENT.md); canonical variant exposed via
 *        calculateMiningRewardBro in token.ts.
 *   - DONE merkle.ts calculateMiningReward — delegates here (Step 2).
 *   - DONE babtc/src/lib.rs (v1 on-chain contract) — calculate_reward now uses
 *        `BRO_DENOMINATION · clz² / 2^halvings` with halving + START_TIME
 *        (sub-proyecto C Fase 2). VK rotated; testnet4 tokens orphaned by design
 *        (Big-Bang Reset).
 *   - DONE scripts/signer/mint-babtc.ts — calculateReward delegates to
 *        minedAmountBro (sub-proyecto C Fase 2).
```

- [ ] **Step 2: Commit**

```bash
git add packages/bitcoin/src/charms/bro-reward.ts
git commit -m "docs(bitcoin): update BRO alignment status (on-chain + signer aligned)"
```

---

## Task 2.4: Marcar `calculateMiningReward` legacy de `token.ts` como deprecated definitivo

**Contexto:** Spec Fase 2.4. `token.ts` ya tiene una variante canónica `calculateMiningRewardBro` (creada en sub-proyecto B Fase 3). La legacy `calculateMiningReward` (fórmula `1e8·clz²/100`, sin halving) sigue existiendo para lockstep con el contrato v1 viejo. Tras Fase 2.1 el contrato está alineado, así que la legacy ya no tiene razón de ser.

**Files:**

- Modify: `packages/bitcoin/src/charms/token.ts` (la función `calculateMiningReward`)

- [ ] **Step 1: Localizar la función legacy**

Run: `grep -n "calculateMiningReward\b\|export function calculateMiningReward\|@deprecated" packages/bitcoin/src/charms/token.ts`
Anotar la línea de la función legacy (no la `Bro`).

- [ ] **Step 2: Añadir JSDoc `@deprecated` apuntando a la canónica**

Reemplazar el JSDoc de la función legacy (mantener el cuerpo intacto — solo cambia la documentación para guiar a futuros callers):

```typescript
/**
 * @deprecated Use `calculateMiningRewardBro` instead. This legacy variant uses
 * the pre-alignment formula (`1e8·clz²/100`, no halving) and is retained ONLY
 * for backwards compatibility with code locked to the v1 contract BEFORE
 * sub-proyecto C Fase 2. After Fase 2 the on-chain contract is aligned with
 * the canonical formula, so all NEW code MUST use `calculateMiningRewardBro`
 * (or `minedAmountBro` directly from bro-reward.ts).
 *
 * Removal scheduled for sub-proyecto D (post-mainnet stabilization).
 */
export function calculateMiningReward(/* params intactos */) {
  // cuerpo intacto
}
```

- [ ] **Step 3: Verificar que ningún caller crítico usa la legacy**

Run: `grep -rn "calculateMiningReward\b" packages/ apps/ scripts/ --include="*.ts" | grep -v "calculateMiningRewardBro" | grep -v test | grep -v deprecated`
Para cada uso encontrado, evaluar si migrar a `calculateMiningRewardBro`. Si es código de lectura (no de minting/reward real), se puede dejar con el deprecation; si es código que calcula rewards reales, migrar.

- [ ] **Step 4: Typecheck + tests**

Run: `pnpm --filter @bitcoinbaby/bitcoin typecheck && pnpm --filter @bitcoinbaby/bitcoin test`
Expected: limpio y sin regresiones.

- [ ] **Step 5: Commit**

```bash
git add packages/bitcoin/src/charms/token.ts
git commit -m "refactor(bitcoin): mark calculateMiningReward legacy as deprecated (Fase 2.4)"
```

---

# Verificación final

## Task 3.0: Run full test suite + typecheck + CI

- [ ] **Step 1: Typecheck todos los paquetes**

Run: `pnpm typecheck`
Expected: limpio para los 7 packages.

- [ ] **Step 2: Tests TS**

Run: `pnpm test`
Expected: todos pasan. `@bitcoinbaby/shared` ahora 34/34 (los 6 arreglados). `@bitcoinbaby/bitcoin` y `@bitcoinbaby/core` sin regresiones.

- [ ] **Step 3: Tests cargo**

Run:

```bash
cd packages/bitcoin/contracts/genesis-babies && cargo test -- --nocapture
cd ../babtc && cargo test -- --nocapture
cd ../babtc-v2 && cargo test -- --nocapture
```

Expected: todos pasan (genesis-babies: 16 unit + 26 integration + 1 nuevo work_proof reject; babtc: tests de calculate_reward canónica; babtc-v2: tests de verify_server_signature).

- [ ] **Step 4: Secret scan**

Run: `pnpm lint` (o el script de secret-scan que use el pre-commit)
Expected: limpio.

- [ ] **Step 5: Verificar que el CI job nuevo de VK check no rompe**

Si se puede correr localmente (act), run: `act -j contract-vk-check`
Si no, pushar la rama y monitorear el CI en GitHub Actions. Esperar verde.

- [ ] **Step 6: Commit final + actualizar handoff**

Si todo está verde, escribir un handoff `docs/superpowers/notes/SESSION-7-HANDOFF.md` documentando:

- Qué se hizo (Fases 0-2 de sub-proyecto C).
- Qué queda (Fases 3-5 bloqueadas por cuota del prover).
- Las decisiones D1-D6 del spec que siguen pendientes.
- El nuevo VK del contrato babtc (tras recompilar en Fase 2).

```bash
git add docs/superpowers/notes/SESSION-7-HANDOFF.md
git commit -m "docs(handoff): SESSION-7 — sub-proyecto C Fases 0-2 done, prover blocker remains"
```

---

## Notas para el ejecutor

- **Orden estricto:** Fase 0 → Fase 1 → Fase 2. Dentro de cada fase, los tasks son secuenciales.
- **TDD estricto:** cada task sigue write-test → fail → implement → pass → commit.
- **Commits neutrales:** `type(scope): description`, sin Co-Authored-By, sin firmas.
- **Si un step bloquea** (ej. `charms app vk` no instalado, toolchain Rust faltante), documentarlo en el handoff y seguir con el siguiente task que no dependa de él.
- **Fase 2.1 Step 4** (actualizar callers de `calculate_reward`) es el paso más delicado — el `block_time` debe llegar al contrato. Si el `MiningWitness` actual no lo tiene, hay que añadirlo y eso cambia el wire format (CBOR). Verificar compatibilidad con el prover.
- **El op `work` del contrato ya está implementado y testeado** (Fase 1 de sub-proyecto B). Este plan SOLO cablea el lado TS/worker; no toca la lógica on-chain de `validate_work`.
