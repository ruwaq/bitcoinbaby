# Handoff — Sesión 6 → Sesión 7

> **Fecha:** 2026-08-08
> **Branch:** `feat/subproyecto-b-hardening-block-tick` (PR pendiente)
> **Main al iniciar sesión:** `a70e89e` (al día con origin)
> **Estado:** Sub-proyecto B (Hardening + Block-Tick Mining) **implementado (Fases 0-6), spec-reviewed, listo para PR**. EZKL (Fase 7) deferred.

---

## Dónde estamos

```
A. Testnet4 profesional NFT     ✅ HECHO (PR #3)
B. Hardening + Block-Tick       ✅ IMPLEMENTADO (esta sesión, Fases 0-6) — PR pendiente
C. Mainnet + launch             ⏳ Pendiente (requiere spec cerrado + auditoría)
```

La sesión 6 implementó las **7 fases** del sub-proyecto B (menos EZKL, que es opcional/final). Cada fase fue implementada por un subagent y **spec-reviewada independientemente** (review doble: compliance + calidad). Todos los tests que se tocaron pasan.

---

## ⚠️ CRÍTICO — el gap que dejó esta sesión (leer antes de deployear)

### El bug C3 está cerrado ON-CHAIN, pero la ruta OFF-CHAIN sigue emitiendo el op vulnerable

**Estado real del C3:**

- ✅ **Contrato** (`genesis-babies/src/lib.rs`): nuevo op `work` deriva XP on-chain de PoW verificado. `WorkWitness` NO tiene campo `xp_gain`. **C3 cerrado en el contrato.**
- ⚠️ **Worker** (`apps/workers/src/routes/nft/evolve.ts:516-621` ruta `POST /work/:tokenId`): aún llama `buildWorkProofSpellRequest` que emite el op `work_proof` DEPRECATED (que confía en `xpGain` del witness). El nuevo op `work` hardenizado tiene **0 callers en TS**.

**¿Es explotable hoy? NO** — la ruta `/work/:tokenId` está gateada por `NFT_APP_ID` (wrangler.toml:102,162), que sigue siendo el placeholder `"0000...0000"`, así que retorna 503 antes de llegar al código vulnerable. La ruta on-chain no está activa hasta que se deployee el app ID real.

**¿Cuándo se vuelve explotable? Cuando alguien deployee el `NFT_APP_ID` real** (después de resolver la cuota del prover). En ese momento, sin arreglar el worker, un atacante con acceso al prover podría forjar XP arbitraria vía la ruta `/work/:tokenId`.

### Acción requerida antes de activar la ruta on-chain (sub-proyecto C)

1. **Cablear el op `work` en el worker.** En `apps/workers/src/routes/nft/evolve.ts:516-621`, reemplazar `buildWorkProofSpellRequest` por un nuevo `buildWorkSpellRequest` que:
   - Valide PoW con `validateMiningProof` (en `apps/workers/src/lib/proof-validation.ts`, ya escrito y correcto) usando el formato `challenge:nonce`.
   - Construya un `WorkWitness { operation: "work", challenge, nonce, difficulty, current_block }` (sin `xp_gain` — el contrato lo deriva).
   - Use `createNFTWorkSpell` (NUEVO — hay que crearlo en `packages/bitcoin/src/charms/nft.ts`, siguiendo el patrón de `createNFTWorkProofSpell` pero con el witness `work`).
2. **Decidir qué hacer con el op `work_proof` deprecated.** Opciones: (a) deshabilitarlo en el match del contrato (`_ => false` en vez de aceptarlo), o (b) mantenerlo pero documentar que el worker nunca debe emitirlo. Recomendado: (a) antes de mainnet, después de migrar NFTs existentes.
3. **Extender `sparkNftStateSchema`** (`apps/workers/src/routes/nft/middleware.ts:135-150`) con los 3 campos de settlement (`narrative_root`, `last_settle_block`, `settle_count`) cuando se cablee el settle en el worker.

El spec step 8 lo listaba como parte de Fase 1, pero se postergó porque requiere `NFT_APP_ID` real (bloqueado por cuota del prover) para probarse E2E.

---

## Lo que SÍ está completo y verificado

### Fase 0 — Limpieza ✅

- Mineros muertos aislados a `packages/core/src/mining/legacy/` (cpu-miner.ts, webgpu-miner.ts, README). No re-exportados del barrel activo.
- `getMinerType()` ahora devuelve `null` honestamente (era `"cpu"` mentiroso).
- `prover-client.ts` (303 líneas orphan) eliminado.
- Configs duplicadas reconciliadas: `testnet4.ts` es la fuente única; `deployment.ts` delega.
- `.claude/memory.md` fuera del tracking git.

### Fase 1 — C3 cerrado on-chain ✅

- `verify_pow` + `count_leading_zeros` + `double_sha256` portados de `babtc` a `genesis-babies`.
- Nuevo op `work` + `WorkWitness` (sin `xp_gain`) + `validate_work` deriva XP via `xp_from_difficulty`.
- 14 unit + 20 integration tests (incl. `work_op_rejects_inflated_xp` que prueba el cierre del exploit).

### Fase 2 — Batch settlement ✅

- Nuevo op `settle` + `SettleWitness` + `validate_settle` (valida transición de estado; Merkle proof completo deferred a EZKL).
- 3 nuevos campos on-chain: `narrative_root`, `last_settle_block`, `settle_count` (con `#[serde(default)]` para lazy migration).
- Campos narrativos **blindados** en todos los validadores no-settle (work, work_proof, level_up).
- `createNFTSettleSpell` en `packages/bitcoin/src/charms/nft.ts`.
- 16 unit + 26 integration tests.

### Fase 3 — Fórmula BRO canónica ✅ (off-chain)

- `packages/bitcoin/src/charms/bro-reward.ts` = referencia única `minedAmountBro` = `1e8 · clz² / 2^halvings`.
- `merkle.ts` delega; `token.ts` añade `calculateMiningRewardBro` (legacy `@deprecated` intacta).
- 16 tests cubren fórmula, halving, clamping, overflow.
- **Deferred a sub-proyecto C:** alineación on-chain (contrato v1 + signer) — requiere redeployment → nuevo VK → migración de tokens testnet4. Ver `BRO_ALIGNMENT.md`.

### Fase 4 — Block-Tick cliente ✅

- `packages/core/src/mining/block-observer.ts`: `BlockObserver` observa chain tip Bitcoin, emite `BlockTick` con `clzObserved`.
- `countLeadingZeroBits` alineado byte-for-byte con el worker (`proof-validation.ts`) y `shared/hash256.ts`.
- Hook opcional en el orchestrator (`setBlockObserver`) — `runAILoop` **intacto** (no roto).
- 27 tests (fetch mocked).

### Fase 5 — Signer hardening ✅

- `generate-wallet.ts`: mnemonic a archivo con 0600, NUNCA a stdout. Verificado funcionalmente.
- `.gitignore`: `.treasury-mnemonic.txt` + `*mnemonic*.txt`.

### Fase 6 — CI/CD ✅

- `.github/workflows/ci.yml` (no existía): lint + typecheck + test (TS) + cargo test (genesis-babies, babtc) + secret-scan + build.
- Fix: bug matemático preexistente en `babtc` `test_count_leading_zeros` (16 → 23).

---

## Tests — estado final

| Suite                    | Resultado                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@bitcoinbaby/bitcoin`   | 557 pass ✅                                                                                                                                               |
| `@bitcoinbaby/core`      | 473 pass ✅                                                                                                                                               |
| `genesis-babies` (cargo) | 16 unit + 26 integration ✅                                                                                                                               |
| `babtc` (cargo)          | 3 pass ✅ (bug preexistente arreglado)                                                                                                                    |
| typecheck (7 packages)   | limpio ✅                                                                                                                                                 |
| `@bitcoinbaby/shared`    | **6 fail preexistentes** (phases.test.ts, tabs `home/explore/you` vs `dashboard/nfts/wallet/more`) — NO introducidos por esta sesión, ya fallaban en main |

---

## Commits del branch (11)

```
e9001b9 test(contracts): fix pre-existing math bug in babtc count_leading_zeros test
e5f62d1 ci: add GitHub Actions workflow (lint+typecheck+test+contracts+secrets+build)
9d55783 feat(mining): add BlockObserver for Block-Tick trustless randomness beacon (Fase 4)
d3d3238 security(signer): write treasury mnemonic to 0600 file, not stdout (Fase 5)
6343cad refactor(rewards): canonical BRO reward formula + off-chain alignment (Fase 3)
d32a46a feat(contracts): add settle operation for batch narrative settlement (Fase 2)
da67d27 test(contracts): integration coverage for work op (C3 closure)
1a3a9ed fix(contracts): close C3 — port verify_pow to genesis-babies, derive XP on-chain
e9612ed chore(config): untrack .claude/memory.md (already gitignored)
e7e7c86 refactor(config): reconcile duplicate SPARK_TESTNET4 configs to single source of truth
1994a52 refactor(mining): isolate dead miners to legacy/, remove orphan prover-client, fix getMinerType()
```

---

## Decisiones de scope (explícitas, para que no se pierdan)

| Tema                             | Decisión                         | Razón                                                                                                                                                                                  |
| -------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `babtc-v2`                       | **Dejar en sitio** (NO archivar) | Producción (`claim-minting-service.ts`) está hardcodeada al binario v2. Archivar rompería minting. Reconciliación v1/v2 + `batch-minting.ts` (3era copia divergente) → sub-proyecto C. |
| Fórmula BRO on-chain             | **Deferred a C**                 | Cambiar contrato v1 cambia el VK → orfana tokens testnet4. Requiere redeployment aceptable en mainnet reset.                                                                           |
| EZKL                             | **Deferred** (Fase 7 opcional)   | No hay PoUW-IA que cerrar (es hash de JSON). Construir EZKL desde cero es 10-12 sesiones. MVP sin EZKL es defendible.                                                                  |
| Ruta `/work/:tokenId` vulnerable | **Documentar (no cablear)**      | Requiere `NFT_APP_ID` real (bloqueado por cuota del prover) para probarse E2E. Hoy está 503-gateada. Acción requerida antes de activar on-chain: ver arriba.                           |
| `runAILoop` del orchestrator     | **Intacto**                      | Reemplazarlo por block-observer rompería el pipeline narrativo/AI. Block-observer añadido como hook opcional.                                                                          |

---

## Dónde arranca la próxima sesión

```
docs/superpowers/notes/SESSION-6-HANDOFF.md  (este archivo)
docs/superpowers/notes/BRO_ALIGNMENT.md      (Fase 3 — qué falta alinear on-chain)
```

**Prioridad 1 (sub-proyecto C, pre-mainnet):** cablear el op `work` en el worker (cerrar C3 end-to-end) antes de deployear `NFT_APP_ID` real.

**Prioridad 2:** resolver la cuota del prover (bloquea todo on-chain real: genesis mint, work, settle).

**Prioridad 3:** reconciliación v1/v2 + fórmula BRO on-chain (reset testnet4 aceptable).

---

## Lo que NO hay que tocar (funciona y está verificado)

- Contrato NFT v15 (`genesis-babies/src/lib.rs`) — extendido con `work` + `settle`, no romper.
- Wallet, game engine, stores, frontend — funcionan.
- `babtc` v1 (PoW on-chain real) — funciona; test bug arreglado.
- Stack Docker regtest — funciona.
- `bro-reward.ts` — canónica, no tocar.
- `block-observer.ts` — funciona, countLeadingZeroBits alineado.
