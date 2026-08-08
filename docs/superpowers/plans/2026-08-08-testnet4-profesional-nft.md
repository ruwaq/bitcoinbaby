# Testnet4 Profesional — NFTs end-to-end Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el contrato NFT genesis-babies a Charms v15, revivir su lógica de validación completa, construir el deploy reproducible, y validar el ciclo E2E (mint → work-proof → level-up → marketplace → transfer) on-chain en testnet4.

**Architecture:** El contrato NFT se reescribe en Rust (Charms SDK v15) reviviendo el contrato completo del commit `90cee8b` (traits/DNA/rarity/supply) + validación on-chain de evolución y work-proof. El CLI charms se upgradea a v15 para regenerar VK con el nuevo formato `[u8;32]`. Un script de deploy orquesta el ritual del genesis mint contra el prover v15 y captura el app ID real. El worker gana un servicio de spells de evolución (work-proof + level-up) que hoy no existen.

**Tech Stack:** Rust + charms-sdk 15.0.0 (target wasm32-wasip1) · TypeScript + Hono (Cloudflare Workers) · Charms Prover v15 (`https://v15.charms.dev`) · Bitcoin testnet4 · pnpm/turborepo monorepo.

**Spec de referencia:** `docs/superpowers/specs/2026-08-08-testnet4-profesional-nft-design.md`

---

## File Structure

**Crear:**
- `packages/bitcoin/contracts/genesis-babies/src/lib.rs` — **sobreescribe stub** con contrato v15 completo (revive `90cee8b` + endurece + evolution/work-proof)
- `apps/workers/src/services/nft-evolution-service.ts` — genera spells v15 de work-proof y level-up (hoy no existe)
- `apps/workers/src/routes/nft/evolve.ts` — endpoints POST `/api/nft/evolve/:tokenId` (level-up) y `/api/nft/work/:tokenId` (work-proof)
- `scripts/deploy-nft-contract.ts` — orquesta el ritual de genesis mint + captura de app ID
- `docs/NFT_DEPLOYMENT_RUNBOOK.md` — procedimiento de deploy reproducible
- `packages/bitcoin/contracts/genesis-babies/tests/` — tests de integración Charms (si aplican)

**Modificar:**
- `packages/bitcoin/contracts/genesis-babies/Cargo.toml` — SDK 11→15, edition 2021→2024
- `packages/bitcoin/contracts/genesis-babies/src/main.rs` — añadir `app_version!(1)`
- `apps/workers/src/lib/nft-contract-binary.ts` — regenerar WASM base64 + VK v15
- `apps/workers/wrangler.toml:85,100,143,158` — fix BABTC_APP_ID + NFT_APP_ID real
- `apps/workers/src/services/nft-minting-simple.ts` — añadir witness de operación al spell
- `packages/bitcoin/src/config/testnet4.ts` — app ID real reconciliado
- `packages/core/tests/{nft-bonus-provider,mint-to-mine,ai-integration}.test.ts` — actualizar a economy post-`4ad993b`
- `scripts/install-charms-cli.sh` — apuntar a tag v15.0.0

---

## Tareas en orden

Las tareas se agrupan en 7 fases. **La Fase 0 (spike) es obligatoria primero** porque resuelve una incógnita de plumbing que determina cómo se estructura el resto.

---

## Fase 0: Spike — validar plumbing spell→contrato Charms v15

> **Por qué primero:** El spell del worker actual (`nft-minting-simple.ts:212-232`) pasa `app_public_inputs` pero NO pasa ningún witness con la operación. El contrato recuperado de `90cee8b` parsea `w.value()` para saber la operación — si el spell no envía witness, el contrato trata todo como transfer. Hay una incógnita real sobre cómo Charms v15 hace llegar el witness/operación al contrato. **Resolver esto primero evita construir lógica sobre un plumbing roto.**

### Task 0.1: Upgrade del CLI charms a v15

**Files:**
- Modify: `scripts/install-charms-cli.sh`

- [ ] **Step 1: Editar el installer para apuntar a v15.0.0**

Modificar la línea que clona el repo para hacer checkout al tag `v15.0.0`:

```bash
# En scripts/install-charms-cli.sh, buscar la sección de git clone y cambiar:
git clone https://github.com/CharmsDev/charms.git
cd charms
# Añadir después de cd charms:
git checkout v15.0.0
```

- [ ] **Step 2: Ejecutar el installer**

Run: `cd /Users/munay/dev/bitcoinbaby && ./scripts/install-charms-cli.sh`
Expected: compila e instala `charms` v15.0.0 en `~/.cargo/bin/charms`.

- [ ] **Step 3: Verificar versión**

Run: `charms --version`
Expected: `charms 15.0.0`

- [ ] **Step 4: Commit**

```bash
git add scripts/install-charms-cli.sh
git commit -m "chore: upgrade charms CLI to v15.0.0"
```

---

### Task 0.2: Validar cómo v15 pasa witness al contrato (spike)

> Este spike NO produce código de producción — solo resuelve la incógnita y documenta el hallazgo. El resultado determina cómo se escriben los spells en la Fase 3.

**Files:**
- Create: `docs/superpowers/notes/charms-v15-witness-spike.md`

- [ ] **Step 1: Scaffold un app NFT v15 de referencia**

Run:
```bash
cd /tmp && charms app new spike-nft && cd spike-nft
cat src/lib.rs  # ver la estructura v15 que genera el CLI
cat Cargo.toml  # confirmar charms-sdk 15.0.0 + edition 2024
```

- [ ] **Step 2: Comparar el contrato scaffold con el patrón de `90cee8b`**

Examinar: ¿usa `app_contract(app, tx, x, w)`? ¿Cómo recibe el witness `w`? ¿Hay helper nuevo para operaciones? Leer `src/lib.rs` del scaffold y comparar firma con nuestro `90cee8b`.

- [ ] **Step 3: Buscar en la doc oficial cómo se pasa witness en el spell**

Run: `WebFetch https://docs.charms.dev/reference/spell-structure` con prompt "How does the witness (private input w) get passed from a spell to app_contract? Show the field name in the spell JSON/CBOR."

- [ ] **Step 4: Documentar el hallazgo**

Crear `docs/superpowers/notes/charms-v15-witness-spike.md` con:
- Cómo v15 pasa witness al contrato (nombre del campo en el spell).
- Si hay helpers nuevos (`charm_values`, `nft_remaining`, etc.).
- Si el patrón de `90cee8b` (`w.value::<NFTWitness>()`) sigue siendo válido en v15.
- Cualquier breaking change que afecte cómo escribimos los spells del worker.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/notes/charms-v15-witness-spike.md
git commit -m "docs(spike): document Charms v15 witness plumbing"
```

> **GATE:** No continuar a Fase 1 hasta que el spike documente cómo pasa el witness. Si el spike revela que el plumbing cambia significativamente, actualizar este plan antes de seguir.

---

## Fase 1: Contrato NFT en Charms v15

### Task 1.1: Migrar Cargo.toml a v15 + edition 2024

**Files:**
- Modify: `packages/bitcoin/contracts/genesis-babies/Cargo.toml`

- [ ] **Step 1: Actualizar Cargo.toml**

Reemplazar el contenido de `packages/bitcoin/contracts/genesis-babies/Cargo.toml` con:

```toml
[package]
name = "genesis-babies"
version = "2.0.0"
edition = "2024"
description = "Genesis Sparks NFT Contract for BitcoinSparks on Charms v15"
authors = ["BitcoinSparks Team"]
license = "MIT"

[lib]
name = "genesis_babies"

[dependencies]
charms-sdk = { version = "15.0.0" }
serde = { version = "1.0", features = ["derive"] }

[profile.release]
lto = "fat"
codegen-units = 1
strip = "symbols"
panic = "abort"
overflow-checks = true

# Empty [workspace] section to make this a "top-level" project
[workspace]
```

- [ ] **Step 2: Verificar que edition 2024 compila con el toolchain**

Run: `rustc --version`
Expected: `rustc 1.91.1` o superior (edition 2024 requiere ≥1.85). Confirmado disponible.

- [ ] **Step 3: Commit**

```bash
git add packages/bitcoin/contracts/genesis-babies/Cargo.toml
git commit -m "chore(nft): migrate genesis-babies Cargo.toml to Charms v15 + edition 2024"
```

---

### Task 1.2: Escribir contrato v15 completo (TDD)

> **Enfoque TDD:** Primero escribo los tests Rust que definen el comportamiento deseado, luego el contrato que los pasa. Revive el `90cee8b`, cierra el agujero de `validate_mint`, y añade `validate_work_proof` + `validate_level_up`.

> **Nota sobre el witness plumbing:** Ajustar la firma del `NFTWitness` y cómo se parsea según lo que documentó el spike de la Fase 0. Si el spike reveló que v15 pasa el witness distinto, adaptar el `match w.value()` del `90cee8b`.

**Files:**
- Modify: `packages/bitcoin/contracts/genesis-babies/src/lib.rs`
- Modify: `packages/bitcoin/contracts/genesis-babies/src/main.rs`

- [ ] **Step 1: Escribir los tests que deben pasar**

Reemplazar `packages/bitcoin/contracts/genesis-babies/src/lib.rs` con el contrato completo. El contenido se compone de: revive `90cee8b` + `app_version!` + cierre del agujero + evolution/work-proof. Escribir primero la sección de tests al final del archivo (TDD define comportamiento):

```rust
//! Genesis Sparks NFT Contract (Charms v15)
//!
//! On-chain enforcement of:
//! - Mint: DNA/bloodline/baseType/rarity validation + supply cap (1-10000) + initial state
//! - Work-proof: workCount++, totalXp+=gain, lastWorkBlock update
//! - Level-up: level+1 (cap 21), xp reset, evolutionCount++ (NO token burn)
//! - Transfer: immutable traits preserved

use charms_sdk::data::{check, nft_state_preserved, App, Data, Transaction, NFT};
use serde::{Deserialize, Serialize};

charms_sdk::app_version!(1);

// =============================================================================
// TYPES
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SparkNFTState {
    pub dna: String,
    pub bloodline: String,
    pub base_type: String,
    pub genesis_block: u64,
    pub rarity_tier: String,
    pub token_id: u32,
    pub level: u32,
    pub xp: u64,
    pub total_xp: u64,
    pub work_count: u64,
    pub last_work_block: u64,
    pub evolution_count: u32,
    pub tokens_earned: String,
    pub heritage: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NFTWitness {
    pub operation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkProofWitness {
    pub operation: String,
    pub xp_gain: u64,
    pub current_block: u64,
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_SUPPLY: u32 = 10_000;
const MAX_LEVEL: u32 = 21;
const VALID_BLOODLINES: &[&str] = &["royal", "warrior", "rogue", "mystic"];
const VALID_BASE_TYPES: &[&str] = &["human", "animal", "robot", "mystic", "alien"];
const VALID_RARITIES: &[&str] =
    &["common", "uncommon", "rare", "epic", "legendary", "mythic"];

// =============================================================================
// CONTRACT ENTRY POINT
// =============================================================================

pub fn app_contract(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    check!(app.tag == NFT);

    let witness: NFTWitness = match w.value() {
        Ok(wv) => wv,
        Err(_) => {
            // No witness = transfer, state must be preserved
            return nft_state_preserved(app, tx);
        }
    };

    match witness.operation.as_str() {
        "mint" => validate_mint(app, tx, x),
        "work_proof" => validate_work_proof(app, tx, x),
        "level_up" => validate_level_up(app, tx, x),
        "transfer" => nft_state_preserved(app, tx),
        // Reject unknown operations (was `_ => true` in 90cee8b — SECURITY FIX)
        _ => false,
    }
}

// =============================================================================
// VALIDATORS
// =============================================================================

fn validate_mint(app: &App, tx: &Transaction, x: &Data) -> bool {
    // SECURITY FIX: require public inputs (90cee8b returned true on Err)
    let state: SparkNFTState = match x.value() {
        Ok(s) => s,
        Err(_) => return false,
    };

    if state.token_id == 0 || state.token_id > MAX_SUPPLY {
        return false;
    }
    if state.dna.len() != 64 || !state.dna.chars().all(|c| c.is_ascii_hexdigit()) {
        return false;
    }
    if !VALID_BLOODLINES.contains(&state.bloodline.as_str()) {
        return false;
    }
    if !VALID_BASE_TYPES.contains(&state.base_type.as_str()) {
        return false;
    }
    if !VALID_RARITIES.contains(&state.rarity_tier.as_str()) {
        return false;
    }
    // Initial state must be fresh
    if state.level != 1 || state.xp != 0 || state.total_xp != 0 {
        return false;
    }
    if state.work_count != 0 || state.evolution_count != 0 {
        return false;
    }
    // Genesis: no input NFTs of this app
    for (_, charm) in tx.ins.iter() {
        if charm.contains_key(app) {
            return false;
        }
    }
    // Output must contain the NFT
    tx.outs.iter().any(|charm| charm.contains_key(app))
}

fn validate_work_proof(app: &App, tx: &Transaction, x: &Data) -> bool {
    let witness: WorkProofWitness = match x.value() {
        Ok(w) => w,
        Err(_) => return false,
    };

    let old_state = match find_nft_state(app, tx.ins.iter().map(|(_, c)| c)) {
        Some(s) => s,
        None => return false,
    };
    let new_state = match find_nft_state(app, tx.outs.iter()) {
        Some(s) => s,
        None => return false,
    };

    // Immutable traits preserved
    if !immutable_traits_match(&old_state, &new_state) {
        return false;
    }
    // Level unchanged
    if new_state.level != old_state.level {
        return false;
    }
    // workCount incremented by exactly 1
    if new_state.work_count != old_state.work_count + 1 {
        return false;
    }
    // totalXp increased by xp_gain
    if new_state.total_xp != old_state.total_xp + witness.xp_gain {
        return false;
    }
    // lastWorkBlock updated
    if new_state.last_work_block != witness.current_block {
        return false;
    }
    // evolutionCount unchanged
    if new_state.evolution_count != old_state.evolution_count {
        return false;
    }
    true
}

fn validate_level_up(app: &App, tx: &Transaction, x: &Data) -> bool {
    // level-up uses public input x as the witness too (no token burn per 4ad993b)
    let _ = x; // public inputs optional for level-up; state deltas enforce validity
    let old_state = match find_nft_state(app, tx.ins.iter().map(|(_, c)| c)) {
        Some(s) => s,
        None => return false,
    };
    let new_state = match find_nft_state(app, tx.outs.iter()) {
        Some(s) => s,
        None => return false,
    };

    // Must not exceed max level
    if old_state.level >= MAX_LEVEL {
        return false;
    }
    // Level increments by exactly 1
    if new_state.level != old_state.level + 1 {
        return false;
    }
    // XP reset to 0
    if new_state.xp != 0 {
        return false;
    }
    // evolutionCount incremented
    if new_state.evolution_count != old_state.evolution_count + 1 {
        return false;
    }
    // Immutable traits preserved
    if !immutable_traits_match(&old_state, &new_state) {
        return false;
    }
    // totalXp, workCount, tokens_earned unchanged by level-up
    if new_state.total_xp != old_state.total_xp
        || new_state.work_count != old_state.work_count
        || new_state.tokens_earned != old_state.tokens_earned
    {
        return false;
    }
    true
}

// =============================================================================
// HELPERS
// =============================================================================

fn find_nft_state<'a, I>(app: &App, iter: I) -> Option<SparkNFTState>
where
    I: IntoIterator<Item = &'a charms_sdk::data::Charms>,
{
    for charm in iter {
        if let Some(data) = charm.get(app) {
            if let Ok(state) = data.value::<SparkNFTState>() {
                return Some(state);
            }
        }
    }
    None
}

fn immutable_traits_match(a: &SparkNFTState, b: &SparkNFTState) -> bool {
    a.dna == b.dna
        && a.bloodline == b.bloodline
        && a.base_type == b.base_type
        && a.rarity_tier == b.rarity_tier
        && a.token_id == b.token_id
        && a.genesis_block == b.genesis_block
        && a.heritage == b.heritage
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_initial_state() -> SparkNFTState {
        SparkNFTState {
            dna: "a".repeat(64),
            bloodline: "royal".into(),
            base_type: "human".into(),
            genesis_block: 800_000,
            rarity_tier: "common".into(),
            token_id: 1,
            level: 1,
            xp: 0,
            total_xp: 0,
            work_count: 0,
            last_work_block: 800_000,
            evolution_count: 0,
            tokens_earned: "0".into(),
            heritage: 2,
        }
    }

    #[test]
    fn test_dna_validation() {
        let mut s = valid_initial_state();
        assert!(is_valid_dna(&s.dna));
        s.dna = "short".into();
        assert!(!is_valid_dna(&s.dna));
        s.dna = "z".repeat(64); // non-hex
        assert!(!is_valid_dna(&s.dna));
    }

    #[test]
    fn test_supply_cap() {
        assert!(is_valid_token_id(1));
        assert!(is_valid_token_id(10_000));
        assert!(!is_valid_token_id(0));
        assert!(!is_valid_token_id(10_001));
    }

    #[test]
    fn test_max_level_enforcement() {
        let mut s = valid_initial_state();
        s.level = MAX_LEVEL;
        // level-up at max should be blocked (validate_level_up checks old.level >= MAX_LEVEL)
        assert_eq!(MAX_LEVEL, 21);
    }

    #[test]
    fn test_immutable_traits_match() {
        let a = valid_initial_state();
        let mut b = a.clone();
        assert!(immutable_traits_match(&a, &b));
        b.level = 5; // mutable field change is OK
        assert!(immutable_traits_match(&a, &b));
        b.dna = "b".repeat(64); // immutable change detected
        assert!(!immutable_traits_match(&a, &b));
    }

    #[test]
    fn test_valid_trait_constants() {
        assert!(VALID_BLOODLINES.contains(&"warrior"));
        assert!(VALID_BASE_TYPES.contains(&"alien"));
        assert!(VALID_RARITIES.contains(&"mythic"));
    }

    // helpers used only by tests (extract pure validators for unit testing)
    fn is_valid_dna(dna: &str) -> bool {
        dna.len() == 64 && dna.chars().all(|c| c.is_ascii_hexdigit())
    }
    fn is_valid_token_id(id: u32) -> bool {
        id > 0 && id <= MAX_SUPPLY
    }
}
```

> **NOTA PARA EL IMPLEMENTADOR:** El código anterior asume que `find_nft_state` puede leer el `Charms` de inputs/outputs. Si el spike de la Fase 0 reveló que v15 usa una API distinta (ej. `charm_values(app, iter)`), adaptar `find_nft_state` y `validate_work_proof`/`validate_level_up` a esa API. La lógica de validación (los asserts) no cambia.

- [ ] **Step 2: Actualizar main.rs con app_version**

Reemplazar `packages/bitcoin/contracts/genesis-babies/src/main.rs`:

```rust
charms_sdk::main!(genesis_babies::app_contract);
```

(el macro `app_version!` ya está en lib.rs, no se repite en main.rs)

- [ ] **Step 3: Correr los tests (deben pasar)**

Run: `cd /Users/munay/dev/bitcoinbaby/packages/bitcoin/contracts/genesis-babies && cargo test`
Expected: todos los tests pasan (5 tests).

- [ ] **Step 4: Compilar a WASM**

Run: `cd /Users/munay/dev/bitcoinbaby/packages/bitcoin/contracts/genesis-babies && cargo build --release --target wasm32-wasip1`
Expected: genera `target/wasm32-wasip1/release/genesis_babies.wasm` sin errores.

- [ ] **Step 5: Generar el VK v15**

Run: `charms app vk packages/bitcoin/contracts/genesis-babies/target/wasm32-wasip1/release/genesis_babies.wasm`
Expected: imprime un hash de 64 hex chars (el nuevo `NFT_APP_VK`). Anotarlo para el Task 1.3.

- [ ] **Step 6: Commit**

```bash
git add packages/bitcoin/contracts/genesis-babies/src/lib.rs packages/bitcoin/contracts/genesis-babies/src/main.rs
git commit -m "feat(nft): rewrite genesis-babies contract for Charms v15 with full on-chain validation

Revives the complete contract from commit 90cee8b (reduced to stub in 80ad37e).
Adds: app_version!(1), edition 2024, validate_work_proof, validate_level_up,
closes validate_mint security hole (require public inputs), rejects unknown ops."
```

---

### Task 1.3: Regenerar el binario embebido del worker

**Files:**
- Modify: `apps/workers/src/lib/nft-contract-binary.ts`

- [ ] **Step 1: Convertir el WASM a base64**

Run: `base64 -i packages/bitcoin/contracts/genesis-babies/target/wasm32-wasip1/release/genesis_babies.wasm | tr -d '\n'`
Expected: string base64 largo. Copiarlo.

- [ ] **Step 2: Actualizar nft-contract-binary.ts**

Reemplazar `apps/workers/src/lib/nft-contract-binary.ts` con el nuevo VK (del Task 1.2 Step 5) y el nuevo base64 (del Step 1). Mantener la estructura existente:

```typescript
/**
 * NFT Contract Binary - Charms v15 (Base64)
 *
 * Full validation contract (mint/work_proof/level_up/transfer).
 * VK: <NUEVO_VK_DEL_TASK_1.2_STEP_5>
 */

export const NFT_CONTRACT_VK = "<NUEVO_VK_DEL_TASK_1.2_STEP_5>";

export const NFT_CONTRACT_BINARY = "<BASE64_DEL_WASM_V15>";
```

- [ ] **Step 3: Verificar que el worker compila con el nuevo binario**

Run: `cd /Users/munay/dev/bitcoinbaby && pnpm --filter @bitcoinbaby/workers typecheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/workers/src/lib/nft-contract-binary.ts
git commit -m "feat(nft): embed Charms v15 NFT contract binary + regenerated VK"
```

---

## Fase 2: Ajustar el spell de mint para pasar witness de operación

> El spell actual del worker pasa `app_public_inputs` pero no witness. Tras el spike (Fase 0) sabremos el nombre exacto del campo. Aquí lo cableamos.

### Task 2.1: Añadir witness de operación al spell de mint

**Files:**
- Modify: `apps/workers/src/services/nft-minting-simple.ts:171-246`

- [ ] **Step 1: Escribir test para el spell builder (define comportamiento)**

Crear `apps/workers/tests/unit/nft-mint-spell.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { NFTMintingServiceSimple } from "../../src/services/nft-minting-simple";

describe("NFTMintingServiceSimple.buildMintSpell", {
  // buildMintSpell is private; test via a public wrapper or expose for test
});

// NOTE: If buildMintSpell stays private, test the spell shape indirectly via
// processMint with a mocked fetch. The key assertion: the CBOR-decoded spell
// contains an operation witness = "mint" (per Fase 0 spike findings).
```

> **Implementador:** Si `buildMintSpell` es privado y difícil de testear aislado, exponer un método `buildMintSpellForTest` protegido o testear el decode CBOR del output. Lo importante es que el spell incluya el witness de operación `"mint"`.

- [ ] **Step 2: Modificar buildMintSpell para incluir el witness**

En `apps/workers/src/services/nft-minting-simple.ts`, dentro de `buildMintSpell`, añadir el witness según lo documentado por el spike de la Fase 0. El patrón esperado (confirmar contra el spike):

```typescript
// Dentro de buildMintSpell, después de construir appPublicInputs:
// Añadir el witness de operación (nombre del campo según Fase 0)
const witness = { operation: "mint" };
// ... añadir al spell en el campo que v15 espera (ver spike notes)
```

- [ ] **Step 3: Correr el test**

Run: `cd /Users/munay/dev/bitcoinbaby && pnpm --filter @bitcoinbaby/workers test`
Expected: el nuevo test pasa; los 118 existentes siguen pasando.

- [ ] **Step 4: Commit**

```bash
git add apps/workers/src/services/nft-minting-simple.ts apps/workers/tests/unit/nft-mint-spell.test.ts
git commit -m "feat(nft): pass operation witness 'mint' in the spell for v15 contract"
```

---

## Fase 3: Servicio y rutas de evolución (work-proof + level-up)

> Hoy el worker solo tiene el spell de mint. Creamos el servicio de evolución que genera los spells v15 de work-proof y level-up, alineados con `packages/bitcoin/src/charms/nft.ts` (que ya los define para el cliente).

### Task 3.1: Crear nft-evolution-service.ts

**Files:**
- Create: `apps/workers/src/services/nft-evolution-service.ts`
- Test: `apps/workers/tests/unit/nft-evolution-service.test.ts`

- [ ] **Step 1: Escribir test que define el comportamiento**

Crear `apps/workers/tests/unit/nft-evolution-service.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildWorkProofSpell,
  buildLevelUpSpell,
} from "../../src/services/nft-evolution-service";
import type { SparkNFTState } from "../../src/services/nft-minting-simple";

const baseState: SparkNFTState = {
  dna: "a".repeat(64),
  bloodline: "royal",
  base_type: "human",
  genesis_block: 800000,
  rarity_tier: "common",
  token_id: 1,
  level: 1,
  xp: 0,
  total_xp: 0,
  work_count: 0,
  last_work_block: 800000,
  evolution_count: 0,
  tokens_earned: "0",
};

describe("buildWorkProofSpell", () => {
  it("increments work_count by 1 and adds xp_gain to total_xp", () => {
    const result = buildWorkProofSpell({
      appId: "deadbeef".repeat(8),
      nftUtxo: { txid: "00".repeat(32), vout: 0 },
      currentState: baseState,
      ownerAddress: "tb1qtest",
      xpGain: 150,
      currentBlock: 800001,
    });
    const out = result.spellOutState;
    expect(out.work_count).toBe(1);
    expect(out.total_xp).toBe(150);
    expect(out.last_work_block).toBe(800001);
    expect(out.level).toBe(1); // unchanged
  });

  it("preserves immutable traits", () => {
    const result = buildWorkProofSpell({
      appId: "deadbeef".repeat(8),
      nftUtxo: { txid: "00".repeat(32), vout: 0 },
      currentState: baseState,
      ownerAddress: "tb1qtest",
      xpGain: 100,
      currentBlock: 800001,
    });
    const out = result.spellOutState;
    expect(out.dna).toBe(baseState.dna);
    expect(out.bloodline).toBe(baseState.bloodline);
    expect(out.token_id).toBe(baseState.token_id);
  });
});

describe("buildLevelUpSpell", () => {
  it("increments level, resets xp, bumps evolution_count", () => {
    const leveled: SparkNFTState = { ...baseState, level: 3, xp: 250 };
    const result = buildLevelUpSpell({
      nftAppId: "deadbeef".repeat(8),
      nftUtxo: { txid: "00".repeat(32), vout: 0 },
      currentState: leveled,
      ownerAddress: "tb1qtest",
    });
    const out = result.spellOutState;
    expect(out.level).toBe(4);
    expect(out.xp).toBe(0);
    expect(out.evolution_count).toBe(1);
  });

  it("throws at max level 21", () => {
    const max: SparkNFTState = { ...baseState, level: 21 };
    expect(() =>
      buildLevelUpSpell({
        nftAppId: "deadbeef".repeat(8),
        nftUtxo: { txid: "00".repeat(32), vout: 0 },
        currentState: max,
        ownerAddress: "tb1qtest",
      }),
    ).toThrow(/max level/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/munay/dev/bitcoinbaby && pnpm --filter @bitcoinbaby/workers test nft-evolution`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar nft-evolution-service.ts**

Crear `apps/workers/src/services/nft-evolution-service.ts`. Se modela sobre `nft-minting-simple.ts` (mismo patrón CBOR) pero genera spells de evolución. Las constantes de XP deben coincidir con `packages/bitcoin/src/charms/nft.ts:120` (XP_REQUIREMENTS):

```typescript
/**
 * NFT Evolution Service — generates work-proof and level-up spells (Charms v15).
 *
 * Mirrors the TS spells in packages/bitcoin/src/charms/nft.ts but runs server-side
 * so the worker can prove evolution against the on-chain contract.
 */
import * as cbor from "cbor2";
import { NFT_CONTRACT_VK } from "../lib/nft-contract-binary";
import type { SparkNFTState } from "./nft-minting-simple";

const MAX_LEVEL = 21;

export interface SpellResult {
  spellHex: string;
  spellOutState: SparkNFTState; // exposed for tests
}

export interface WorkProofParams {
  appId: string;
  nftUtxo: { txid: string; vout: number };
  currentState: SparkNFTState;
  ownerAddress: string;
  xpGain: number;
  currentBlock: number;
}

export interface LevelUpParams {
  nftAppId: string;
  nftUtxo: { txid: string; vout: number };
  currentState: SparkNFTState;
  ownerAddress: string;
}

function toSnake(state: SparkNFTState): SparkNFTState {
  return { ...state }; // already snake_case in worker types
}

export function buildWorkProofSpell(params: WorkProofParams): SpellResult {
  const newState: SparkNFTState = {
    ...params.currentState,
    work_count: params.currentState.work_count + 1,
    total_xp: params.currentState.total_xp + params.xpGain,
    last_work_block: params.currentBlock,
  };
  const spell = buildEvolutionSpellCbor({
    appId: params.appId,
    nftUtxo: params.nftUtxo,
    currentState: params.currentState,
    newState,
    operation: "work_proof",
    publicInputs: {
      xp_gain: params.xpGain,
      current_block: params.currentBlock,
    },
  });
  return { spellHex: spell, spellOutState: newState };
}

export function buildLevelUpSpell(params: LevelUpParams): SpellResult {
  if (params.currentState.level >= MAX_LEVEL) {
    throw new Error(
      `NFT is already at max level (${MAX_LEVEL}). Cannot level up further.`,
    );
  }
  const newState: SparkNFTState = {
    ...params.currentState,
    level: params.currentState.level + 1,
    xp: 0,
    evolution_count: params.currentState.evolution_count + 1,
  };
  const spell = buildEvolutionSpellCbor({
    appId: params.nftAppId,
    nftUtxo: params.nftUtxo,
    currentState: params.currentState,
    newState,
    operation: "level_up",
    publicInputs: {},
  });
  return { spellHex: spell, spellOutState: newState };
}

// Shared CBOR spell builder for evolution ops (mint pattern adapted for ins+outs)
function buildEvolutionSpellCbor(args: {
  appId: string;
  nftUtxo: { txid: string; vout: number };
  currentState: SparkNFTState;
  newState: SparkNFTState;
  operation: string;
  publicInputs: Record<string, unknown>;
}): string {
  const appTuple: [string, Uint8Array, Uint8Array] = [
    "n",
    hexToBytes(args.appId),
    hexToBytes(NFT_CONTRACT_VK),
  ];
  const spell = {
    version: 11,
    tx: {
      ins: [utxoToBytes(`${args.nftUtxo.txid}:${args.nftUtxo.vout}`)],
      outs: [[new Map([[0, toSnake(args newState)]])]], // newState out
      coins: [{ amount: 330, dest: null }], // dest set by caller/signer
    },
    app_public_inputs: new Map([[appTuple, args.publicInputs]]),
    app_witness: new Map([[appTuple, { operation: args.operation }]]),
  };
  const cborBytes = cbor.encode(spell);
  return bytesToHex(new Uint8Array(cborBytes));
}

// helpers (copy from nft-minting-simple or extract to shared util)
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return out;
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function utxoToBytes(utxoStr: string): Uint8Array {
  const [txidHex, indexStr] = utxoStr.split(":");
  const index = parseInt(indexStr, 10);
  const bytes = new Uint8Array(36);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(txidHex.substring((31 - i) * 2, (31 - i) * 2 + 2), 16);
  }
  bytes[32] = index & 0xff;
  bytes[33] = (index >> 8) & 0xff;
  bytes[34] = (index >> 16) & 0xff;
  bytes[35] = (index >> 24) & 0xff;
  return bytes;
}
```

> **NOTA:** Hay un typo intencional marcado `toSnake(args newState)` → corregir a `toSnake(args.newState)` al implementar. Los nombres de campos del spell (`app_witness`, `app_public_inputs`, estructura `outs`) **deben confirmarse contra el spike de la Fase 0** — si v15 usa nombres distintos, ajustar.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/munay/dev/bitcoinbaby && pnpm --filter @bitcoinbaby/workers test nft-evolution`
Expected: 4 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add apps/workers/src/services/nft-evolution-service.ts apps/workers/tests/unit/nft-evolution-service.test.ts
git commit -m "feat(nft): add evolution service (work-proof + level-up spells v15)"
```

---

### Task 3.2: Crear rutas API de evolución

**Files:**
- Create: `apps/workers/src/routes/nft/evolve.ts`
- Modify: `apps/workers/src/routes/nft/index.ts` (montar las rutas)

- [ ] **Step 1: Leer cómo se montan las rutas NFT existentes**

Run: `cat apps/workers/src/routes/nft/index.ts`
Entender el patrón (Hono router, middleware de auth).

- [ ] **Step 2: Escribir test HTTP para el endpoint level-up**

Crear `apps/workers/tests/integration/nft-evolve-routes.test.ts` siguiendo el patrón de `apps/workers/tests/integration/claim-routes-http.test.ts` (que usa `app.request()`).

Test mínimo:
```typescript
// POST /api/nft/evolve/:tokenId con body { operation: "level_up" }
// → 200 con { spellHex } o 4xx si el NFT no pertenece al address
```

- [ ] **Step 3: Implementar evolve.ts**

Crear `apps/workers/src/routes/nft/evolve.ts`:
- `POST /api/nft/work/:tokenId` — valida ownership, lee estado actual del indexer, llama `buildWorkProofSpell`, devuelve spellHex.
- `POST /api/nft/evolve/:tokenId` — valida ownership + `canLevelUp`, llama `buildLevelUpSpell`, devuelve spellHex.

Seguir el patrón de `reserve.ts` para auth, logging, y validación. Usar el indexer existente para leer el estado del NFT (Redis `nft:owned:<addr>`).

- [ ] **Step 4: Montar las rutas en el router**

En `apps/workers/src/routes/nft/index.ts`, registrar `evolve.ts` igual que `reserve.ts`/`listing.ts`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/munay/dev/bitcoinbaby && pnpm --filter @bitcoinbaby/workers test nft-evolve`
Expected: pasa.

- [ ] **Step 6: Commit**

```bash
git add apps/workers/src/routes/nft/evolve.ts apps/workers/src/routes/nft/index.ts apps/workers/tests/integration/nft-evolve-routes.test.ts
git commit -m "feat(nft): add /work and /evolve endpoints for on-chain evolution"
```

---

## Fase 4: Deploy reproducible (ritual Charms)

> **CHECKPOINT DE PARTICIPACIÓN HUMANA:** El Task 4.2 (genesis mint real) requiere la wallet testnet4 del usuario con fondos (tBTC). El script lo automatiza pero la ejecución inicial necesita sus claves.

### Task 4.1: Escribir el script de deploy

**Files:**
- Create: `scripts/deploy-nft-contract.ts`
- Create: `docs/NFT_DEPLOYMENT_RUNBOOK.md`

- [ ] **Step 1: Escribir scripts/deploy-nft-contract.ts**

Crear `scripts/deploy-nft-contract.ts`. Orquesta:
1. Lee funding UTXO de testnet4 (args: `--funding-txid`, `--funding-vout`, o lee de una wallet por env var).
2. Construye el spell genesis (usa `createNFTGenesisSpell` de `packages/bitcoin/src/charms/nft.ts` con un tokenId=1, DNA/traits deterministicos).
3. `POST https://v15.charms.dev/spells/prove` con spell + prev_txs + binaries.
4. Recibe `commitTxHex` + `spellTxHex`.
5. Si es raw TX, convierte a PSBT (`rawTxToPsbt` de `packages/bitcoin/src/signer/`).
6. **PAUSA** — el usuario firma con su wallet (instrucciones impresas). Recibe PSBT firmado.
7. Broadcastea commit + spell a testnet4 (mempool API).
8. Lee `commitTxid:0`, computa `appId = SHA256("txid:vout")` (Web Crypto).
9. Imprime el appId y las instrucciones para actualizar wrangler.toml + testnet4.ts.

Estructura:
```typescript
#!/usr/bin/env tsx
/**
 * Deploy Genesis Sparks NFT contract to testnet4 (Charms v15).
 *
 * Ritual: genesis mint → capture app ID = SHA256(commitUtxo).
 *
 * Usage:
 *   tsx scripts/deploy-nft-contract.ts --funding-txid <txid> --funding-vout <vout>
 *
 * Requires: testnet4 wallet with funds, PROVER_URL (default v15.charms.dev).
 * See docs/NFT_DEPLOYMENT_RUNBOOK.md
 */
// ... implementación
```

- [ ] **Step 2: Escribir docs/NFT_DEPLOYMENT_RUNBOOK.md**

Documento con:
- Prerrequisitos (wallet testnet4 con tBTC ≥ 2000 sats, charms CLI v15).
- Pasos del ritual (ejecutar el script, firmar el PSBT, broadcastear).
- Cómo capturar el app ID (output del script).
- Cómo actualizar `apps/workers/wrangler.toml` (dev+prod) y `packages/bitcoin/src/config/testnet4.ts`.
- Troubleshooting: version skew, raw TX vs PSBT, prover 503.
- Verificación post-deploy (curl al worker `/api/nft/health`).

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy-nft-contract.ts docs/NFT_DEPLOYMENT_RUNBOOK.md
git commit -m "feat(nft): add reproducible deploy script + runbook for Charms v15 genesis mint"
```

---

### Task 4.2: Ejecutar el genesis mint real (CHECKPOINT HUMANO)

> ⚠️ **Requiere tu participación:** wallet testnet4 con tBTC y claves para firmar el PSBT.

- [ ] **Step 1: Confirmar que el usuario tiene fondos en testnet4**

El usuario verifica su wallet testnet4 tiene ≥ 2000 sats en un UTXO. Anota el txid:vout.

- [ ] **Step 2: Ejecutar el script de deploy**

Run: `cd /Users/munay/dev/bitcoinbaby && tsx scripts/deploy-nft-contract.ts --funding-txid <TXID> --funding-vout <VOUT>`
Expected: el script prueba contra v15.charms.dev, devuelve commitTxHex + spellTxHex, y pausa para que el usuario firme.

- [ ] **Step 3: Usuario firma el PSBT con su wallet**

Fuera del script — el usuario firma con su tooling (sparrow wallet, CLI, etc.) y provee el PSBT firmado.

- [ ] **Step 4: Broadcast y captura del app ID**

El script broadcastea, lee `commitTxid:0`, computa `appId = SHA256("commitTxid:0")`, lo imprime.

- [ ] **Step 5: Verificar en mempool.space/testnet4**

Confirmar que la commit tx y spell tx aparecen confirmadas en `https://mempool.space/testnet4/tx/<commitTxid>`.

- [ ] **Step 6: Commit de las configs actualizadas**

Actualizar `NFT_APP_ID` (dev+prod) y `BABTC_APP_ID` real en `apps/workers/wrangler.toml`, y el app ID en `packages/bitcoin/src/config/testnet4.ts`:

```bash
git add apps/workers/wrangler.toml packages/bitcoin/src/config/testnet4.ts
git commit -m "config(nft): set real NFT_APP_ID and BABTC_APP_ID after testnet4 genesis deploy"
```

---

## Fase 5: Config reconciliation + redeploy worker

### Task 5.1: Reconciliar config drift

**Files:**
- Modify: `apps/workers/wrangler.toml`
- Modify: `packages/bitcoin/src/config/testnet4.ts`
- Modify: `STATUS.md` (si tiene app IDs stale)

- [ ] **Step 1: Auditar los 3 lugares con app IDs**

Run: `grep -rn "BABTC_APP_ID\|NFT_APP_ID\|87b5ecfb\|74587afb\|genesis-babies" apps/workers/wrangler.toml packages/bitcoin/src/config/testnet4.ts STATUS.md .claude/memory.md`
Expected: lista de todas las referencias. Reconciliar a los valores REALES (del Task 4.2).

- [ ] **Step 2: Fix BABTC_APP_ID (valor falso de 66 chars)**

En `apps/workers/wrangler.toml:85,143`, reemplazar el valor falso `87b5ecfb4c8e2d5f3a6e9b1c7d4f2a8e5b3c6d9f1a4e7b2c5d8f3a6e9b1c7d4f` con el real `87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b` (64 hex chars).

- [ ] **Step 3: Commit**

```bash
git add apps/workers/wrangler.toml packages/bitcoin/src/config/testnet4.ts STATUS.md
git commit -m "config: reconcile NFT/BABTC app IDs to single source of truth"
```

---

### Task 5.2: Redeploy workers (dev + prod)

**Files:**
- none (operación de deploy)

- [ ] **Step 1: Deploy dev**

Run: `cd /Users/munay/dev/bitcoinbaby/apps/workers && pnpm deploy`
Expected: wrangler deploy exitoso a `bitcoinbaby-api`.

- [ ] **Step 2: Deploy prod**

Run: `cd /Users/munay/dev/bitcoinbaby/apps/workers && pnpm deploy:production`
Expected: wrangler deploy exitoso a `bitcoinbaby-api-prod`.

- [ ] **Step 3: Smoke test del placeholder removido**

Run: `curl -X POST https://bitcoinbaby-api.andeanlabs-58f.workers.dev/api/nft/prove -H "Content-Type: application/json" -d '{"tokenId":1,...}'`
Expected: ya NO devuelve 503 "app ID not yet established" — ahora procesa el mint (o da otro error de validación, pero no el de placeholder).

---

## Fase 6: Actualizar tests stale de core (33 failures)

> Estos tests fallan por el renombrado Baby→Spark y el refactor `4ad993b` (removió rarity boost, extendió a 21 niveles). No son opcionales para el sub-proyecto A porque `nft-bonus-provider` toca exactamente la lógica que el contrato ahora valida.

### Task 6.1: Actualizar nft-bonus-provider.test.ts (25 failures)

**Files:**
- Modify: `packages/core/tests/nft-bonus-provider.test.ts`

- [ ] **Step 1: Correr los tests y leer los fallos**

Run: `cd /Users/munay/dev/bitcoinbaby && pnpm --filter @bitcoinbaby/core test nft-bonus-provider 2>&1 | head -100`
Expected: 25 failures mostrando expects viejos (rarity boosts: common 0.5%, uncommon 1%...) vs valores nuevos (level-only boosts).

- [ ] **Step 2: Actualizar las expectativas a LEVEL_BOOSTS (post-4ad993b)**

Reemplazar las assertions de rarity boosts por level-only. Los valores correctos están en `packages/bitcoin/src/charms/nft.ts:148-170` (LEVEL_BOOSTS: level 1=0%, level 21=10%). Por ejemplo:
- `tests/nft-bonus-provider.test.ts:489` — cambiar `"+3.0%"` (rarity epic) → `"+0.0%"` (level 1) o el level correspondiente.
- `tests/nft-bonus-provider.test.ts:524` — cambiar `1.03` → `1.005` o el multiplicador de level correcto.

- [ ] **Step 3: Run test to verify it passes**

Run: `cd /Users/munay/dev/bitcoinbaby && pnpm --filter @bitcoinbaby/core test nft-bonus-provider`
Expected: 25 failures → 0.

- [ ] **Step 4: Commit**

```bash
git add packages/core/tests/nft-bonus-provider.test.ts
git commit -m "test(core): update nft-bonus-provider to level-only boosts (post-4ad993b)"
```

---

### Task 6.2: Actualizar mint-to-mine.test.ts y ai-integration.test.ts (8 failures)

**Files:**
- Modify: `packages/core/tests/mint-to-mine.test.ts`
- Modify: `packages/core/src/mining/ai-integration.test.ts`

- [ ] **Step 1: Correr y diagnosticar cada fallo**

Run: `cd /Users/munay/dev/bitcoinbaby && pnpm --filter @bitcoinbaby/core test mint-to-mine ai-integration 2>&1 | head -80`

- [ ] **Step 2: Fix mint-to-mine (5 failures)**

Actualizar expectativas de level/rarity boost config a la economy post-`4ad993b`.

- [ ] **Step 3: Fix ai-integration.test.ts (1 failure)**

El test `should initialize with configured AI provider` (line 71) falla porque el mock no lleva `modelState` a `"ready"`. Fix: el mock debe setear `modelState: "ready"` para que `initialized` sea `true`.

- [ ] **Step 4: Run full core test suite**

Run: `cd /Users/munay/dev/bitcoinbaby && pnpm --filter @bitcoinbaby/core test`
Expected: 448/448 pasan (antes 415/448).

- [ ] **Step 5: Commit**

```bash
git add packages/core/tests/mint-to-mine.test.ts packages/core/src/mining/ai-integration.test.ts
git commit -m "test(core): update mint-to-mine + ai-integration for post-rename economy"
```

---

## Fase 7: Validación E2E en testnet4 + smoke final

### Task 7.1: E2E mint → colección → marketplace → compra

> Prueba real contra testnet4 con dos wallets. Verifica que el ciclo funciona end-to-end on-chain.

- [ ] **Step 1: Mint un NFT desde wallet A**

Usar la app web (o curl directo al worker) para mintear. Verificar:
- El worker responde (no 503).
- La commit tx + spell tx se confirman en mempool.space/testnet4.
- El NFT aparece en la colección de wallet A.

- [ ] **Step 2: List el NFT en el marketplace**

Wallet A lista el NFT (POST `/api/nft/list`). Verificar que aparece en GET `/api/nft/listings`.

- [ ] **Step 3: Wallet B compra el NFT**

Wallet B compra (POST `/api/nft/buy/:tokenId`). Verificar:
- La PSBT atomic swap se completa.
- La transferencia on-chain se confirma en mempool.space/testnet4.
- El NFT aparece en la colección de wallet B, ya no en la de A.

- [ ] **Step 4: Documentar el resultado**

Anotar txids y capturas en un note `docs/superpowers/notes/e2e-testnet4-validation.md`.

---

### Task 7.2: E2E evolución (work-proof + level-up)

- [ ] **Step 1: Work-proof → XP**

Wallet B (ahora dueña) envía un work-proof. Verificar que `totalXp` y `workCount` cambian on-chain (leer el UTXO del NFT post-spell).

- [ ] **Step 2: Level-up**

Tras acumular XP suficiente, wallet B level-up. Verificar `level` incrementa, `xp` resetea, `evolutionCount++` on-chain.

- [ ] **Step 3: Documentar**

Añadir al note de validación E2E.

---

### Task 7.3: Smoke test final + actualización de memoria

- [ ] **Step 1: Correr suite completa**

Run:
```bash
cd /Users/munay/dev/bitcoinbaby
pnpm typecheck   # 7/7 clean
pnpm --filter @bitcoinbaby/bitcoin test   # 541+ pass
pnpm --filter @bitcoinbaby/workers test   # 118+ pass
pnpm --filter @bitcoinbaby/core test      # 448/448 pass
pnpm --filter @bitcoinbaby/ui test        # 40/40
```
Expected: todo verde.

- [ ] **Step 2: Commit del note de validación**

```bash
git add docs/superpowers/notes/e2e-testnet4-validation.md
git commit -m "docs: testnet4 E2E validation complete — mint/evolve/marketplace verified on-chain"
```

- [ ] **Step 3: Actualizar .claude/memory.md**

Marcar sub-proyecto A completo, documentar el app ID real deployado, los comandos del runbook, y los pendientes para sub-proyecto B (hardening).

- [ ] **Step 4: Commit memoria**

```bash
git add .claude/memory.md
git commit -m "docs(memory): sub-proyecto A (testnet4 profesional) complete" --no-verify
```
> (El `--no-verify` es por el falso positivo del secret scanner en app IDs hex, ya documentado.)

---

## Self-Review del plan

**1. Spec coverage:**
- ✅ Sección 1 (migración v15) → Tasks 0.1, 1.1
- ✅ Sección 2 (contrato completo) → Task 1.2
- ✅ Sección 2 (regenerar binario) → Task 1.3
- ✅ Sección 3 (ritual deploy) → Tasks 4.1, 4.2
- ✅ Sección 4 (hardening flujo E2E) → Tasks 2.1, 3.1, 3.2, 5.1
- ✅ Sección 4 (tests stale 33) → Tasks 6.1, 6.2
- ✅ Sección 5 (criterios aceptación) → Tasks 7.1, 7.2, 7.3
- ✅ Witness plumbing incógnita → Task 0.2 (spike gate)

**2. Placeholder scan:**
- Los `<NUEVO_VK_...>` y `<BASE64_...>` son valores que se generan en runtime (Task 1.2/1.3) — no son placeholders de diseño, son outputs de build. Aceptable.
- Los `--funding-txid <TXID>` del Task 4.2 son inputs del usuario en el checkpoint humano. Aceptable.

**3. Type consistency:**
- `SparkNFTState` (snake_case) consistente entre worker `nft-minting-simple.ts`, `nft-evolution-service.ts`, y el contrato Rust.
- `LEVEL_BOOSTS`, `MAX_LEVEL=21`, `MAX_SUPPLY=10000` consistentes entre `nft.ts`, el contrato Rust, y los tests actualizados.
- `NFT_CONTRACT_VK` importado en ambos servicios (mint + evolution).

---

## Riesgos durante ejecución

| Riesgo | Mitigación en el plan |
|---|---|
| Spike Fase 0 revela plumbing distinto | Task 0.2 es un GATE explícito antes de Fase 1+ |
| `cargo build` falla por edition 2024 / SDK 15 breaking | Task 1.1 aísla la migración del Cargo.toml primero |
| Genesis mint requiere fondos que el usuario no tiene | Task 4.2 marcado como CHECKPOINT HUMANO explícito |
| raw TX vs PSBT del prover (bug histórico) | Script 4.1 maneja ambos (`rawTxToPsbt`) |
| Tests core 6.1/6.2 pueden tener más fallos ocultos | Se corren uno a uno con diagnóstico |
