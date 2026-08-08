# Sub-proyecto B: Hardening + Block-Tick Mining — económico, ecológico y accesible

> **Fecha:** 2026-08-08
> **Estado:** Diseño — pendiente de aprobación
> **Alcance:** Sub-proyecto B de 3 (A: ✅ mergeado · **B: este** · C: mainnet + launch)
> **Decisión del usuario:** "completo (con EZKL probabilístico)" — económico y ecológico, accesible a todos (no solo mineros)

---

## Contexto y por qué existe este spec

El sub-proyecto A dejó el contrato NFT Charms v15 completo y mergeado, pero el **review de seguridad previo** encontró 3 bugs críticos. C1 (XP unconstrained) y C2 (tokens_earned forjable) se cerraron en el PR #3. **C3 sigue abierto y bloquea mainnet**: el contrato confía en `xp_gain` del witness sin verificar PoW real — un atacante con acceso al prover podría forjar XP arbitraria.

Investigamos 3 frentes en paralelo (ecosistema Charms, modelos económicos, modelos ecológicos) y los hallazgos convergen en una arquitectura que **cumple simultáneamente** los requisitos de seguridad (cerrar C3), economía (99% menos costo que BRO), ecología (no duplicar el PoW de Bitcoin) y accesibilidad universal (no requerir mineros ni recursos altos).

### Hallazgos clave que motivan el diseño

1. **BRO canónico cuesta ~$20-40/jugador/día** (2 TXs Bitcoin por work + 10-20 min latencia). *Proof of Play (Pirate Nation) cerró en agosto 2025* demostrando que "todo on-chain por acción" no es sostenible.
2. **El ecosistema CharmsDev (26 repos) no tiene ningún juego con mining barato** — no hay patrón copiable; hay que construirlo.
3. **Bitcoinbaby hoy NO es más ecológico que BRO**: `webgpu-miner.ts` usa el mismo SHA-256d paralelo (duplica energía), y `ai-integration.ts` solo hashea texto de API (no es PoUW verificable).
4. **La solución ya está ~80% diseñada** en `docs/AI_WORLD_ENGINE.md` (arquitectura 2 capas) y `docs/TECHNICAL_DECISIONS.md` punto 10 (verificación probabilística EZKL con slashing). Falta implementar.
5. **El block hash de Bitcoin es un beacon de aleatoriedad trustless** (paper IACR 2015/1015) — se puede reusar el PoW que Bitcoin ya hace **sin que el jugador mine ni tenga ASIC**.

---

## Decisiones de scope (explícitas)

| Decisión | Elección | Razón |
|---|---|---|
| Modelo de mining | **Block-Tick + Batch Settlement** (no BRO canónico, no merge mining) | BRO es insostenible; merge mining requiere abandonar Charms por RSK; este modelo cumple económico + ecológico + accesible simultáneamente |
| Fórmula de reward | **BRO exacta**: `1e8 · clz² / 2^halvings` | Decisión del usuario; alinea las 3 fórmulas inconsistentes actuales a una sola fuente de verdad |
| Aleatoriedad | **Block hash de Bitcoin** (trustless, sin oráculo) | Reusa PoW existente sin duplicar energía; accesible (jugador observa, no mina) |
| Verificación IA | **EZKL probabilístico (5% sampling + slashing)** | Cierra el gap semi-trustless→trustless sin el costo de verificar 100% ZK; diseño ya en TECHNICAL_DECISIONS.md |
| Verificación del cierre de C3 | **On-chain en el contrato wasm** (Merkle root verify) | Trustless: el contrato verifica la root, no confía en el witness libre |
| Migration path | **No romper el contrato v15 mergeado** — extenderlo | El sub-proyecto A está en main; los cambios son aditivos (nuevos campos, nueva operación `settle`) |

---

## Sección 1 — Arquitectura "Block-Tick + Batch Settlement"

### Visión general

```
┌──────────────────────────────────────────────────────────────────┐
│  CAPA INSTANTÁNEA (off-chain, cliente ligero)                    │
│                                                                  │
│  El jugador "juega" en navegador/móvil:                          │
│  • 0 TX Bitcoin por click                                        │
│  • 0 hashing SHA-256d (no duplica PoW de Bitcoin)                │
│  • El block hash de Bitcoin (cada ~10 min) = 1 "tick" global     │
│    → aleatoriedad TRUSTLESS (no oráculo, no servidor)            │
│  • XP y eventos se acumulan en Merkle tree en el cliente         │
│  • Receipts firmados por el backend (semi-trustless)             │
│                                                                  │
│  Accesible a TODOS: sin ASIC, sin GPU, sin minar Bitcoin         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ Batch periódico (diario/semanal)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  CAPA DE SETTLEMENT (on-chain, Charms v15)                       │
│                                                                  │
│  1 spell `settle` commitea por jugador (o por batch global):     │
│  • narrativeRoot (Merkle root de eventos) → CIERRA C3            │
│  • XP acumulada DERIVADA de ticks observados (no witness libre)  │
│  • Fórmula BRO exacta: 1e8·clz²/2^halvings                       │
│                                                                  │
│  Costo: ~$0.05-0.10/jugador/día (vs $20-40 de BRO)               │
└──────────────────────────────────────────────────────────────────┘
```

### Por qué esto es ecológico

- **Cero hashing del jugador** — no duplica el PoW de Bitcoin (a diferencia de `webgpu-miner.ts` actual).
- **El block hash se lee, no se mina** — el PoW que Bitcoin ya gastó se reusa como beacon de aleatoriedad.
- **El cómputo de IA, cuando se haga con EZKL, es "útil"** (inferencia real vs hash aleatorio).

### Por qué esto es accesible

- El cliente solo observa bloques Bitcoin (RPC/indexer gratuito) y juega.
- No requiere ASIC, GPU, ni fondos para fees de TX por acción.
- Funciona en navegador/móvil de bajos recursos.

---

## Sección 2 — Cierre de C3: verificación on-chain de la Merkle root

### El bug C3 hoy

`validate_work_proof` en `genesis-babies/src/lib.rs:279-336` acepta `xp_gain` del witness (`WorkProofWitness.xp_gain`) y solo verifica que los contadores tick por esa cantidad. Un atacante puede declarar `xp_gain = 999999` y el contrato lo aprueba.

### El fix: nueva operación `settle`

Se añade una **nueva operación** al contrato (no se rompe `work_proof` existente — se depreca en favor de `settle`):

```rust
match operation_from_witness(w) {
    "mint"       => validate_mint(...),           // sin cambios
    "work_proof" => validate_work_proof(...),     // DEPRECAR (mantiene retrocompat)
    "level_up"   => validate_level_up(...),       // sin cambios
    "transfer"   => nft_state_preserved(...),     // sin cambios
    "settle"     => validate_settle(app, tx, x, w), // NUEVO — cierra C3
    _            => false,
}
```

**`validate_settle`** (la función que cierra C3):

```rust
fn validate_settle(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    let s: SettleWitness = match w.value() { Ok(v) => v, Err(_) => return false };
    let old_state = extract_nft_state(&tx.ins);   // estado on-chain actual
    let new_state = extract_nft_state(&tx.outs);  // estado propuesto

    // (1) XP se DERIVA de los ticks observados, no se acepta libre
    let observed_ticks = s.end_block.saturating_sub(old_state.last_settle_block);
    let derived_xp = compute_xp_from_ticks(observed_ticks, &s.tick_proofs);

    // (2) La Merkle root debe matching los eventos del cliente
    if !verify_merkle_root(&s.events_root, &s.merkle_proof, &s.event_leaf) {
        return false;
    }

    // (3) new_state.total_xp == old_state.total_xp + derived_xp  (no xp_gain libre)
    if new_state.total_xp != old_state.total_xp.checked_add(derived_xp) { return false; }

    // (4) Fórmula BRO exacta para el reward del token SPARK (clz_observed del block hash)
    let clz_observed = count_leading_zero_bits(&s.end_block_hash);
    let reward = mined_amount_bro(s.end_block_time, clz_observed);
    if new_state.tokens_earned != old_state.tokens_earned.checked_add(reward) { return false; }

    // (5) last_settle_block avanza
    if new_state.last_settle_block != s.end_block { return false; }

    true
}
```

**Clave:** `xp_gain` ya **no existe como input del witness**. El XP se **deriva** dentro del contrato a partir de los ticks observados y los proofs de inclusión Merkle. Un atacante no puede declarar XP libre.

### Nuevos campos en `SparkNFTState` (aditivo, no rompe v15)

```rust
// Campos existentes (sin cambios)...
level, xp, total_xp, work_count, last_work_block, evolution_count, tokens_earned

// NUEVOS (Block-Tick settlement):
narrative_root: [u8; 32],       // Merkle root de eventos desde último settle
last_settle_block: u64,         // último bloque Bitcoin settleado
settle_count: u32,              // nº de settlements (anti-replay)
```

Costo on-chain: ~40 bytes extra (~$0.02 a 20 sat/vB).

---

## Sección 3 — Fórmula BRO exacta y reconciliación

### Las 3 fórmulas inconsistentes hoy

| Lugar | Fórmula | Estado |
|---|---|---|
| `scripts/signer/mint-babtc.ts:214` | `2^(D-16) * 1000` | ❌ Falsa ("BRO-style" pero no es BRO) |
| `babtc/src/lib.rs:180-194` | `1e8 * D² / 100` | ❌ No es BRO, no coincide con mint-babtc |
| BRO canónico (`libbro/src/calc.rs`) | `1e8 · clz² / 2^halvings` | ✅ La real |

### Acción: alinear todo a BRO exacta

Implementar **una sola función** `mined_amount_bro(block_time, clz)` en el contrato wasm:

```rust
const DENOMINATION: u64 = 100_000_000;
const HALVING_PERIOD_SECONDS: u64 = 14 * 24 * 3600;
const START_TIME: u64 = 1756830000; // 2025-09-02 UTC

fn mined_amount_bro(block_time: u64, clz: usize) -> u64 {
    let block_time = block_time.max(START_TIME);
    let clz = clz as u64;
    let halving_idx = (block_time - START_TIME) / HALVING_PERIOD_SECONDS;
    let halving_factor = 2u64.checked_pow(halving_idx as u32).unwrap_or(u64::MAX);
    DENOMINATION.checked_mul(clz.pow(2)).unwrap_or(u64::MAX) / halving_factor
}
```

Y reflejarla en **todos los lugares off-chain** (signer, cliente, docs) para que coincidan. El `mint-babtc.ts` y el `babtc/src/lib.rs` se actualizan a esta fórmula.

**Nota:** el halving cada 14 días desde 2025-09-02 es la configuración de BRO. Si bitcoinbaby quiere una economía distinta (ej: sin halving, o halving más lento), es una decisión explícita que se documenta aquí. Por defecto adoptamos BRO exacta como pediste.

---

## Sección 4 — Block-Tick: aleatoriedad trustless del block hash de Bitcoin

### Reconciliación clave: ¿qué es `clz` en este modelo?

En BRO canónico, `clz` = leading zeros del hash que **el jugador minó**. En Block-Tick, **el jugador no mina**, así que `clz` no puede venir de su trabajo. Hay dos interpretaciones, y separamos explícitamente:

- **`clz_observed`** (para el reward BRO-estilo): los leading zeros del **block hash de Bitcoin observado**. Bitcoin ya hizo el trabajo; nosotros lo leemos. Es trustless y ecológico (no duplicamos energía), pero **varía con la suerte de Bitcoin** (a veces el bloque tiene muchos leading zeros, a veces pocos). Esto reproduce fielmente la economía BRO: en BRO los rewards varían con la suerte del minero; aquí varían con la suerte de la red Bitcoin.
- **`ticks`** (para el XP del juego): el conteo de bloques observados desde el último settle. Es la medida de "tiempo activo" del jugador — más estable y predecible que `clz_observed`.

**Decisión de economía (en el spec):**
- **XP del juego** se deriva de `ticks` observados (estable, determinístico): `xp = ticks_active × BASE_XP_PER_TICK × activity_multiplier`.
- **Reward del token SPARK** usa la fórmula BRO exacta con `clz_observed` del último bloque settleado: `reward = mined_amount_bro(block_time, clz_observed)`.

Esto separa limpiamente "progreso del jugador" (ticks) de "emisión del token" (clz del block hash) y mantiene ambos trustless.

### Mecanismo del tick

Cada ~10 min, Bitcoin mina un bloque. Su hash es:
- **Inmanipulable** (requiere re-minar el bloque).
- **Público y verificable** (cualquier nodo/indexer lo expone).
- **Trustless** (no requiere oráculo — el hash está en la cadena).

El juego lo usa como **beacon de aleatoriedad** y como fuente de `clz_observed`:

```typescript
// Cada tick (bloque Bitcoin observado):
const block = await fetchLatestBlock();  // RPC/indexer gratuito
const tick = {
  blockHeight: block.height,
  blockHash: block.hash,
  clzObserved: countLeadingZeroBits(block.hash),  // para reward BRO
  timestamp: block.time,
};

// XP del juego (estable, basado en actividad):
const active = wasPlayerActiveThisTick(playerId);  // off-chain receipt
const xpThisTick = active ? BASE_XP_PER_TICK : 0;
```

### Verificación on-chain del tick

El `SettleWitness` incluye `tick_proofs` — una serie compacta de `(blockHeight, blockHash)` que el contrato verifica contra la dificultad de Bitcoin (el hash debe cumplir el target, y sus leading zeros = `clz_observed` que alimenta el reward). Esto evita que el backend invente ticks.

**Honestidad técnica:** verificar bloques Bitcoin dentro del wasm Charms **no es trivial** (Charms no expone acceso nativo al block header). El diseño pragmático es:
- **MVP:** el backend atestigua los ticks (semi-trustless). El contrato verifica la Merkle root y la consistencia de los contadores, y deriva `clz_observed` del block hash atestiguado.
- **Trustless total (capa EZKL, Sección 5):** un sample del 5% de los settlements debe presentar SPV proof del bloque Bitcoin, verificable on-chain. Si falla, slashing.

Esto cierra C3 en el MVP y lo acerca a trustless total con EZKL.

---

## Sección 5 — Verificación probabilística EZKL (5% + slashing)

### Objetivo

Cerrar el gap semi-trustless→trustless del PoUW-IA (que hoy solo hashea texto de API, no verificable).

### Mecanismo (diseño ya en `TECHNICAL_DECISIONS.md` punto 10)

1. **Todos** los jugadores envían un **checksum ligero** de sus events/ticks acumulados.
2. Un **5% elegido aleatoriamente** (determinístico vía block hash) debe presentar una **prueba EZKL completa** — prueba criptográfica de que la inference de IA realmente se ejecutó en su dispositivo.
3. Si la prueba falla o no se presenta → **slashing** del colateral/stake del jugador.

### Componentes

- **EZKL en browser (WASM):** exporta el modelo ONNX → circuito Halo2 → zk-SNARK. Se ejecuta en el dispositivo del jugador.
- **Verifier en el Worker (Cloudflare):** valida la prueba EZKL (no on-chain en Bitcoin — inviable por límite 4MB/bloque, confirmado por reporte #2).
- **Selección aleatoria del 5%:** derivada del block hash (trustless, no servidor).
- **Stake/slashing economy:** el jugador deposita un colateral al entrar; si es seleccionado y falla, pierde parte del colateral.

### Honestidad sobre madurez

EZKL en browser es **pesado** (cargas WASM grandes, latency de proving). Esto se implementa como **capa opt-in** sobre el batch settlement básico. El MVP (Sección 2) funciona sin EZKL; EZKL añade trust a la capa IA.

---

## Sección 6 — Signer hardening

La auditoría `docs/audits/SECURITY_AUDIT_2026-03-08.md` reportó issues. Los críticos relevantes al signer:

| Issue | Archivo | Acción |
|---|---|---|
| `generate-wallet.ts` imprime mnemonic a stdout | `scripts/signer/generate-wallet.ts:37-57,87` | Mover a env var / file con permisos 0600, nunca stdout |
| `.claude/memory.md` commiteado al repo (no gitignored) | `.claude/memory.md` | `git rm --cached` + añadir a `.gitignore` (flag de la sesión 5) |
| `BATCH_WALLET_SEED` en `env.example` (comentado pero presente) | `env.example` | Revisar que no haya leaked en historial git; rotar si hubo |

El signer del worker (`treasury-signer.ts`) está bien externalizado por diseño (el worker solo prepara batches, no firma). No requiere cambio arquitectónico — solo hardening de los scripts auxiliares.

---

## Sección 7 — CI/CD (no existe)

### Estado actual

- **No hay `.github/workflows/`** — el directorio no existe.
- El pre-commit hook (`husky`) dice "ESLint enforced in CI via turbo lint" **pero esa CI no existe**.
- Sin tests automáticos en PR/push.

### Acción: crear GitHub Actions

```yaml
# .github/workflows/ci.yml
- lint (turbo lint)
- typecheck (turbo typecheck)
- test (turbo test — workers, core, bitcoin)
- contract tests (cargo test en genesis-babies)
- secret scan (reusar scripts/scan-secrets.sh)
- build (turbo build — smoke)
```

Gate de merge: PR requiere CI verde. Reactiva la barandilla que el pre-commit hook asume que existe.

---

## Sección 8 — Criterios de aceptación

Todo debe pasar antes de declarar el sub-proyecto B completo:

### Cierre de C3 (core)
1. Nueva operación `settle` en `genesis-babies/src/lib.rs`, con `validate_settle` que deriva XP de ticks + verifica Merkle root.
2. `xp_gain` **ya no es input del witness** para el path de settlement (depredado en `work_proof`).
3. `cargo test` cubre `settle` con casos: accept válido, reject XP libre, reject Merkle root mal, reject tick falso.
4. E2E regtest: un settle real con mock prover pasa (cuota de prover sigue siendo bloqueo on-chain, pero la lógica se valida).

### Fórmula BRO
5. `mined_amount_bro` implementada en contrato wasm.
6. `mint-babtc.ts`, `babtc/src/lib.rs` alineados a la misma fórmula.
7. Test: las 3 implementaciones producen el mismo output para inputs canónicos.

### Block-Tick + Batch
8. Cliente observa block hash de Bitcoin y computa XP trustlessly.
9. Worker orquesta batch settlement (1 spell/día/jugador).
10. `narrative_root`, `last_settle_block`, `settle_count` persisten on-chain.

### EZKL (capa trust)
11. EZKL en browser genera prueba de inference (modelo simple para MVP).
12. Worker valida la prueba EZKL.
13. 5% sampling determinístico via block hash.
14. Slashing economy documentada (stake mínimo, penalty).

### Signer + CI
15. `generate-wallet.ts` no imprime mnemonic a stdout.
16. `.claude/memory.md` removido del tracking + en `.gitignore`.
17. `.github/workflows/ci.yml` corre lint+typecheck+test+secret-scan en cada PR.
18. PR requiere CI verde para mergear.

---

## Sección 9 — Lo que se CORTA explícitamente (va en C / mainnet)

- Deploy de contratos a mainnet.
- Auditoría externa de seguridad (requiere spec cerrado primero).
- Migración del token SPARK a v15.
- Mobile stores, Vercel final deploy.
- Manager-NFT / supply cap avanzado.
- PoUW real con modelo de IA de producción (MVP usa modelo simple).

---

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| EZKL en browser es pesado (latency, RAM) | Capa opt-in; MVP funciona sin EZKL. Modelos simples primero. |
| Block hash verification en Charms wasm no es nativa | MVP semi-trustless (backend atestigua); EZKL layer cierra con SPV sampling |
| Verificación probabilística 5% puede permitir fraude pequeño | Slashing economy desincentiva; ajustar % si hace falta |
| Cuota del prover sigue bloqueando settle on-chain real | La lógica del contrato se valida con cargo test + mock prover; el settle real espera cuota |
| Migración de estado de NFTs v15 existentes | Nueva operación `settle` es aditiva; NFTs existentes migran lazy al primer settle |

---

## Referencias

- Spec sub-proyecto A: `docs/superpowers/specs/2026-08-08-testnet4-profesional-nft-design.md`
- Diseño 2 capas: `docs/AI_WORLD_ENGINE.md` (líneas 24-58)
- EZKL probabilístico: `docs/TECHNICAL_DECISIONS.md` puntos 9-10
- BRO canónico: `https://github.com/CharmsDev/bro` (`libbro/src/calc.rs` para la fórmula)
- Paper block hash beacon: `https://eprint.iacr.org/2015/1015.pdf`
- Handoff sesión 4→5: `docs/superpowers/notes/SESSION-4-HANDOFF.md`
- Auditoría previa: `docs/audits/SECURITY_AUDIT_2026-03-08.md`
- Reportes de investigación sesión 5: Charms ecosystem, economic models, ecological models (en `.claude/memory.md`)

---

# ADDÉNDUM (Sesión 5, post-exploración del código real)

> **Fecha del addéndum:** 2026-08-08 (misma sesión, después de explorar el código real)
> **Cambio:** El diseño Block-Tick arriba **sigue válido**, pero la **estrategia de implementación cambia** porque una exploración profunda del código (4 agentes leyeron cada `.ts`/`.tsx`/`.rs`) reveló que hay piezas reutilizables, piezas muertas, y fachadas que el spec original no consideraba.

## A1. La verdad del código vs los docs (resumen)

El spec original se basó en `README.md`, `STATUS.md`, `AI_WORLD_ENGINE.md`. El código real muestra un panorama distinto:

### Funciona de verdad (código real y conectado)
- **Wallet HD** (`packages/bitcoin/src/wallet.ts`): BIP39/86, Taproot, PSBT, zeroing de keys. ✅
- **Game engine** (`packages/core/src/game/`): decay, 11 achievements, XP, evolutions, game loop fixed-timestep. ✅
- **15 stores Zustand**: estado real, consumidos por el frontend. ✅
- **Frontend completo** (`apps/web/src/`): mint flow, marketplace, wallet send, claim — todos cableados a APIs reales, no mocks. ✅
- **Charms prover integration** (`apps/workers/src/services/`): CBOR real, retry, spells V9/V10/V11. ✅
- **Contrato NFT v15** (`genesis-babies/src/lib.rs`): 26 tests, estricto en transiciones de estado. ✅
- **Contrato token v1** (`babtc/src/lib.rs`): PoW on-chain REAL (recomputa double-SHA256). ✅

### Es fachada/muerto/incompleto (crítico)
- **Mineros muertos**: `cpu-miner.ts` (657 líneas, SHA-256d Web Workers real) y `webgpu-miner.ts` (985 líneas, shader WGSL SHA-256) → **0 instanciaciones**. El `orchestrator.ts` ya no los usa; `getMinerType()` miente ("cpu").
- **"PoUW" no verificable**: `ai-integration.ts` solo hashea output de API de IA. `baby-brain.ts` (450 líneas) es **template-filling procedural**, no IA. **`packages/ai` no tiene Transformers.js ni ningún modelo** (solo en comentarios).
- **Sistema PoW clásico DESCONECTADO**: `processMiningCredit` (valida hash256 + difficulty como BRO) y `validateMiningProof` (`proof-validation.ts`) → **código huérfano sin caller**. La ruta `/credit` valida con Schnorr del proof de IA, no PoW.
- **Contrato `babtc-v2` = CÁSCARA**: `verify_server_signature` retorna `true` tras solo validar longitud (64 chars) + charset hex. `SERVER_PUBKEY_HASH = "DEPLOY_TIME_PUBKEY_HASH"` placeholder jamás leído. Tests con cero cobertura.
- **NFT on-chain BLOQUEADO**: `NFT_APP_ID = "0000...0000"` placeholder → `/nft/prove`, `/work`, `/evolve` siempre 503.
- **Signer del tesoro NO EXISTE**: `treasury-signer.ts` comentario "Does NOT do actual signing". `batch-minting.ts` usa `"TREASURY_UTXO_PLACEHOLDER"`. No hay `/api/withdraw`.
- **Código muerto**: `prover-client.ts` (303 líneas, sin consumidores), configs duplicados (`deployment.ts` vs `testnet4.ts`), dos sistemas baby/spark paralelos.

## A2. Lo que el código cambia en este spec

### Cambio 1: Cerrar C3 reutilizando código existente (no escribiendo nuevo)

El spec original asumía que había que escribir el validador PoW. **Falso**: ya existe en dos lugares:

| Código existente | Dónde | Qué hace | Reutilización |
|---|---|---|---|
| `verify_pow` + `count_leading_zeros` + `double_sha256` | `babtc/src/lib.rs:202-228` | Recomputa hash256 on-chain, cuenta leading zeros (estilo BRO) | **Portar a `genesis-babies/src/lib.rs`** para `validate_settle` |
| `validateMiningProof` + `countLeadingZeroBits` + `hash256Hex` | `apps/workers/src/lib/proof-validation.ts:61-161` | Valida PoW off-chain (hash, nonce, difficulty, dedup KV) | **Cablear a la ruta `/work/:tokenId`** (hoy no lo invoca) |
| `processMiningCredit` | `apps/workers/src/services/mining-credit.ts` | Orquesta validación PoW → reward BRO-style | **Revivir como caller** del path de settlement |
| Ruta vieja `POST /:tokenId/work-proof` | `apps/workers/src/routes/nft/evolve.ts:248-361` | YA valida PoW real con `countLeadingZeroBits` + dedup SETNX | **Fuente de inspiración** — pero solo muta Redis, no on-chain |

**Implicación:** la Sección 2 del spec (nueva operación `settle`) se implementa **portando `verify_pow` de babtc a genesis-babies** + **cableando `validateMiningProof` en el worker**, no escribiendo criptografía nueva.

### Cambio 2: Decisión sobre babtc-v2 (cáscara)

El spec original no mencionaba `babtc-v2`. Ahora hay que decidir:

- **Opción A (recomendada):** **Matar `babtc-v2`**. Su verificación de firma es decorativa (retorna `true`); no aporta seguridad. El token de reward real es `babtc` v1 (que SÍ verifica PoW). `babtc-v2` se archiva o elimina.
- **Opción B:** **Arreglar `babtc-v2`** implementando `verify_server_signature` real (ed25519/HMAC contra pubkey real, no placeholder). Más trabajo, y su modelo (server-signed claims) es ortogonal al Block-Tick.

**Decisión por defecto (avanzo con juicio):** Opción A (matar), a menos que quieras el modelo server-signed para algo específico. Documentar la decisión en el plan.

### Cambio 3: Decisión sobre los mineros muertos

`cpu-miner.ts` y `webgpu-miner.ts` están escritos y correctos pero **0 instanciaciones**. El modelo Block-Tick **no los necesita** (el jugador no mina — observa bloques). Opciones:

- **Opción A (recomendada):** **Aislar en `packages/core/src/mining/legacy/`** con README explicando que son referencia BRO-canónica no usada en producción. No borrar (son código bueno), pero marcar como no-ruta-activa.
- **Opción B:** **Eliminar.** Código muerto = deuda. Pero se pierde 1600 líneas de implementación SHA-256 WebGPU útil como referencia.

**Decisión por defecto:** Opción A (aislar), porque el código es bueno y puede servir para modo "hardcore mining" opcional futuro. Documentar.

### Cambio 4: EZKL es construir desde cero (no mejorar)

El spec decía "cierra el gap semi-trustless→trustless del PoUW-IA". El código muestra que **no hay PoUW-IA que cerrar** — el proof actual es hash de JSON, y no hay Transformers.js. Por tanto:

- EZKL no es "mejorar PoUW existente", es **construir PoUW desde cero** (cargar modelo ONNX en browser, generar prueba Halo2).
- Esto es **más trabajo del estimado**. Sub-proyecto B completo se acerca al rango alto (10-12 sesiones, no 8).
- **Decisión por defecto:** el EZKL pasa a ser **fase final opcional del sub-proyecto B**. El MVP (C3 + batch + fórmula + signer + CI) se entrega primero y ya es defendible. EZKL es "capa trust extra" que puede ir en sub-proyecto B.5 o C.

### Cambio 5: Orden de implementación (limpieza primero)

Antes de añadir Block-Tick, el spec añade una **Fase 0: limpieza de código muerto y reconciliación**:
1. Aislar mineros muertos (`legacy/`).
2. Decidir babtc-v2 (matar o arreglar).
3. Eliminar `prover-client.ts` muerto o revivirlo.
4. Reconciliar configs duplicadas (`deployment.ts` vs `testnet4.ts`) a una fuente de verdad.
5. `git rm --cached .claude/memory.md` + `.gitignore`.
6. Quitar `getMinerType()` mentiroso (devuelve "cpu" sin haber miner).

Esto deja el repo honesto antes de construir sobre él.

## A3. Mapa de código reutilizable (qué tocar en cada fase)

| Fase | Archivo a tocar | Acción |
|---|---|---|
| 0. Limpieza | `packages/core/src/mining/{cpu,webgpu}-miner.ts` | Mover a `legacy/` |
| 0. Limpieza | `packages/bitcoin/contracts/babtc-v2/` | Archivar o eliminar |
| 0. Limpieza | `apps/workers/src/services/prover-client.ts` | Eliminar o revivir |
| 0. Limpieza | `packages/bitcoin/src/config/{deployment,testnet4}.ts` | Reconciliar a uno |
| 0. Limpieza | `.claude/memory.md` | `git rm --cached` + `.gitignore` |
| 1. C3 | `genesis-babies/src/lib.rs` | Portar `verify_pow` de babtc → nueva op `settle` |
| 1. C3 | `apps/workers/src/routes/nft/evolve.ts:516-627` | Cablear `validateMiningProof` en `/work/:tokenId` |
| 1. C3 | `apps/workers/src/services/mining-credit.ts` | Revivir como caller del path PoW |
| 2. Batch | `packages/bitcoin/src/charms/nft.ts` | Añadir `createSettleSpell` (F7 de AI_WORLD_ENGINE) |
| 2. Batch | `genesis-babies/src/lib.rs` | Añadir campos `narrative_root`, `last_settle_block`, `settle_count` |
| 3. Fórmula | `genesis-babies/src/lib.rs` + `babtc/src/lib.rs` + `scripts/signer/mint-babtc.ts` | Alinear a `mined_amount_bro` |
| 4. Block-Tick | `packages/core/src/mining/orchestrator.ts` | Reemplazar loop IA por observer de bloques |
| 4. Block-Tick | NUEVO `packages/core/src/mining/block-observer.ts` | Lee block hash, computa tick + clz_observed |
| 5. Signer | `scripts/signer/generate-wallet.ts` | No imprimir mnemonic a stdout |
| 6. CI | `.github/workflows/ci.yml` | Crear (hoy no existe) |
| 7. EZKL (opcional) | NUEVO `packages/ai/src/ezkl/` | Construir desde cero |

## A4. Criterios de aceptación revisados

Los criterios de la Sección 8 se mantienen, pero añaden:
- **19.** No hay `getMinerType()` que mienta (eliminado o devuelve null si no hay miner).
- **20.** Mineros muertos aislados en `legacy/` (no en ruta activa).
- **21.** `babtc-v2` decidido (archivado o arreglado — documentar cuál).
- **22.** `.claude/memory.md` fuera del tracking git.
- **23.** Config de deployment reconciliada a una fuente de verdad.
