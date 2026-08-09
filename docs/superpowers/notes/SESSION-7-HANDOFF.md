# Handoff — Sesión 7 → Sesión 8

> **Fecha:** 2026-08-09
> **Branch:** `feat/subproyecto-c-fases-0-2` (PR pendiente)
> **Main al iniciar sesión:** `662948e` (sub-proyecto B merged)
> **Estado:** Sub-proyecto C **Fases 0, 1 y 2 IMPLEMENTADAS y verificadas**. C3 cerrado end-to-end. Fórmula BRO alineada on-chain + off-chain. Riesgo supply-chain documentado + barandilla CI añadida. Fases 3-5 (genesis mint, E2E, mainnet) siguen bloqueadas por la cuota del prover.

---

## Dónde estamos

```
A. Testnet4 profesional NFT     ✅ HECHO (PR #3)
B. Hardening + Block-Tick       ✅ HECHO (PR #6, commit 662948e)
C. Mainnet + launch
   ├─ Fase 0 — Limpieza + build  ✅ HECHO (esta sesión)
   ├─ Fase 1 — Cierre C3 E2E     ✅ HECHO (esta sesión)
   ├─ Fase 2 — BRO on-chain      ✅ HECHO (esta sesión)
   ├─ ⚠️ BLOQUEO: cuota prover   (NO es código — requiere decisión operador)
   ├─ Fase 3 — Genesis mint      ⏳ Bloqueada (requiere cuota)
   ├─ Fase 4 — E2E testnet4      ⏳ Bloqueada
   └─ Fase 5 — Mainnet + audit   ⏳ Bloqueada
```

Spec completo en `docs/superpowers/specs/2026-08-09-subproyecto-c-mainnet-launch-design.md`.
Plan de implementación en `docs/superpowers/plans/2026-08-09-subproyecto-c-mainnet-launch.md`.

---

## Lo que SÍ está completo y verificado (esta sesión)

### Fase 0 — Limpieza + hardening de build ✅

- **6 tests stale de `@bitcoinbaby/shared`** arreglados (nomenclatura tabs `dashboard/nfts/wallet/more` → `home/explore/you`). Commit `1268dae`.
- **`docs/audits/VK_RECONCILIATION.md`** escrito: documenta los 3-4 VKs divergentes del contrato babtc v1 + los 3 binarios WASM embebidos como strings TS (118KB + 334KB + 353KB). Hallazgo clave: `cargo build` y `charms app build` producen wasms DISTINTOS para el mismo fuente. Commit `9075abb`.
- **Scanner allowlist:** 6 VKs públicas añadidas a `scripts/scan-secrets.sh` para evitar falsos positivos (las VKs son públicas por definición).
- **CI job `contract-vk-check`** añadido a `.github/workflows/ci.yml`: buildea los 3 contratos desde source (`cargo build --release --target wasm32-wasip1 --locked`) y verifica que el VK coincide con el binario embebido. Commit `adb0602`.
- **`verify_server_signature` de babtc-v2** arreglado: era decorativo (solo chequeaba longitud+charset y retornaba `true`). Ahora hace HMAC-SHA256 real con comparación constant-time. 4 tests (incluido positivo). Commit `87ed273`.

### Fase 1 — Cierre C3 end-to-end ✅

**El gap crítico que dejó la sesión 6 está CERRADO en ambas puntas.**

- **On-chain** (contrato genesis-babies): el op `work_proof` DEPRECATED está **desactivado** (match arm eliminado, cae a `_ => false`). El op `work` hardenizado (que deriva XP de PoW verificado) es el único camino. Commit `ed6c4a0`.
- **Off-chain** (worker):
  - `createNFTWorkSpell` añadido a `packages/bitcoin/src/charms/nft.ts` (client-side SpellV2 builder). Commit `3131605`.
  - `buildWorkSpellRequest` añadido a `apps/workers/src/services/nft-evolution-service.ts`: valida PoW con `validateMiningProof` ANTES de construir el spell, deriva xp_gain de la dificultad verificada, construye witness `{operation:"work", challenge, nonce, difficulty, current_block}` (sin `xp_gain`). Commit `16ff7229`.
  - Ruta `POST /work/:tokenId` en `evolve.ts` reemplazada: ya NO acepta `xpGain` del cliente; acepta PoW inputs y valida server-side. Commit `e3ed4a2`.
  - `sparkNftStateSchema` extendido con 3 campos de settlement (`narrative_root`, `last_settle_block`, `settle_count`, opcionales para lazy migration). Commit `6739559`.

**Hoy no es explotable** (la ruta sigue 503-gateada por `NFT_APP_ID` placeholder), pero **ahora está cerrado ANTES de activar el app ID real**, que era el requerimiento.

### Fase 2 — Reconciliación BRO on-chain ✅

- **Contrato babtc v1** (`calculate_reward`): reescrito para usar la fórmula canónica `1e8·clz²/2^halvings` con halving cada 14 días desde `BRO_START_TIME`. `MiningWitness` ahora lleva `block_time: u64`. Constants EXACTAMENTE iguales a `bro-reward.ts`. Commit `221a6b09`.
- **Signer + TS consumers**: `calculateReward` del signer ahora delega a `minedAmountBro` (antes usaba la fórmula divergente `2^(d-16)*1000`). Ambos `PoWPrivateInputsV11` (types.ts + v11/types.ts) ahora llevan `block_time`. `submitter.ts` pasa `proof.timestamp`. Commit `907b244`.
- **Status de alineación** actualizado en `bro-reward.ts`: todo marcado DONE (on-chain + signer). Commit `1c061da`.
- **`calculateMiningReward` legacy** en `token.ts` marcado `@deprecated DEFINITIVE` (Fase 2.4). Commit `1c061da`.

---

## Tests — estado final (TODOS VERDES)

| Suite                  | Resultado                       |
| ---------------------- | ------------------------------- |
| `@bitcoinbaby/shared`  | 34 pass ✅ (6 arreglados)       |
| `@bitcoinbaby/ui`      | 40 pass ✅                      |
| `@bitcoinbaby/web`     | 22 pass ✅ (2 stale arreglados) |
| `@bitcoinbaby/core`    | 473 pass ✅                     |
| `@bitcoinbaby/bitcoin` | 563 pass ✅                     |
| `@bitcoinbaby/workers` | 154 pass ✅                     |
| typecheck (7 packages) | limpio ✅                       |
| genesis-babies (cargo) | 23 pass ✅                      |
| babtc (cargo)          | 7 pass ✅                       |
| babtc-v2 (cargo)       | 6 pass ✅                       |

---

## Commits del branch (14)

```
195f975 test(web): fix stale welcome copy in DashboardSection (BitcoinBaby→Start Mining)
1c061da docs(bitcoin): BRO alignment complete — on-chain + signer aligned, legacy deprecated
907b244 fix(signer): align TS consumers with canonical BRO formula + block_time witness
221a6b0 fix(contracts): align babtc calculate_reward with canonical BRO formula
ed6c4a0 fix(contracts): disable work_proof op post-reset (C3 closure, D2)
6739559 feat(workers): extend sparkNftStateSchema with settlement fields
e3ed4a2 feat(workers): replace /work route with PoW-validated op 'work' (C3 closure)
16ff722 feat(workers): add buildWorkSpellRequest (PoW-validated, op 'work')
3131605 feat(bitcoin): add createNFTWorkSpell for op 'work' (C3 closure)
87ed273 fix(contracts): babtc-v2 verify_server_signature cryptographic (HMAC-SHA256)
adb0602 ci: add contract VK reproducibility check (build WASM from source)
9075abb docs(audit): document divergent babtc VKs and embedded binaries risk
1268dae test(shared): fix stale tab nomenclature in phases.test.ts (dashboard→home)
8451e2c docs(spec): sub-proyecto C — Mainnet + Launch (Big-Bang Reset, 5 fases)  [spec + plan]
```

---

## ⚠️ FOLLOW-UPS CONOCIDOS (NO bloqueantes para merge, pero importantes)

### 1. El CI job `contract-vk-check` se pondrá ROJO en el primer run

Los 3 binarios WASM embebidos (`babtc-contract-binary.ts`, `babtc-v2-contract-binary.ts`, `nft-contract-binary.ts`) están **stale** respecto al source compilado limpio. Esto es **esperado y correcto** — el job fue diseñado para detectar exactamente esto (defense-in-depth). Razones:

- `babtc-v2`: cambió en esta sesión (HMAC, commit `87ed273`).
- `babtc`: cambió en esta sesión (calculate_reward canónica, commit `221a6b0`).
- `genesis-babies`: cambió en sub-proyecto B (settle op) y esta sesión (disable work_proof).

**Acción requerida antes de hacer el CI job obligatorio (merge gate):** regenerar los 3 binarios embebidos desde `cargo build --release --target wasm32-wasip1 --locked` y commitearlos. Esto capturará los nuevos VKs. Hacerlo DESPUÉS de mergear este PR (o como último commit antes del PR). Documentado en `docs/audits/VK_RECONCILIATION.md`.

### 2. `createNFTWorkSpell` (Task 1.1) es código muerto

El builder client-side en `packages/bitcoin/src/charms/nft.ts` (formato SpellV2, version 2) **no es usado** por el worker (que usa `buildSpellObject` formato v15 wire). Es legítimo como builder client-side para futuro uso React (su sibling `createNFTWorkProofSpell` tampoco tiene callers en el worker), pero está actualmente sin consumers. **Decisión:** dejarlo (consistencia con el sibling). Si no se va a usar client-side, remover en sub-proyecto D.

### 3. `SERVER_SECRET_HEX` de babtc-v2 es placeholder (all zeros)

El HMAC funciona (tests positivos y negativos pasan), pero el secret real debe generarse al deploy time desde el treasury signer y reemplazarse antes de compilar el wasm de mainnet. Documentado en el código con `TODO (deploy)`.

### 4. Signer usa `Date.now()` para `block_time`

El signer (`mint-babtc.ts`) no tiene acceso a un Bitcoin block header, así que usa wall-clock time para `block_time`. Esto es consistente con el flujo existente, pero si el contrato alguna vez valida `block_time` contra un bloque real, habría que revisitarlo. El path de producción (`submitter.ts`) sí usa `proof.timestamp` real.

### 5. `submitter.ts` líneas ~581, ~688 siguen llamando `calculateMiningReward` legacy

Es solo para **display** (no alimenta el witness ni el spell on-chain). Migrar a `calculateMiningRewardBro` cuando se retire el path display v1. Documentado en `bro-reward.ts` status block.

---

## Dónde arranca la próxima sesión

```
docs/superpowers/notes/SESSION-7-HANDOFF.md  (este archivo)
docs/superpowers/specs/2026-08-09-subproyecto-c-mainnet-launch-design.md  (spec completo)
docs/superpowers/plans/2026-08-09-subproyecto-c-mainnet-launch.md  (plan, Fases 0-2 done)
docs/audits/VK_RECONCILIATION.md  (VKs divergentes)
```

### Prioridad 1 (ANTES de activar on-chain): resolver la cuota del prover

El spec sección 5 D1 lista las opciones:

- **(a) Comprar ≥16.32 PROVE credits** en Succinct Prover Network via `v15.charms.dev`.
- **(b) Self-host SP1 prover** (`cargo install charms --locked --bin charms-prover --features prover` + `charms-prover server`). Gratis, ~minutos/ proof. No dockerizado aún.
- **(c) No existe tercera opción** documentada.

Sin resolver esto, Fases 3-5 están bloqueadas.

### Prioridad 2 (después de cuota): regenerar binarios embebidos + activar CI gate

Ver follow-up #1 arriba.

### Prioridad 3: Fases 3-5 del spec (genesis mint → E2E → mainnet)

Una vez resuelta la cuota, seguir `docs/NFT_DEPLOYMENT_RUNBOOK.md` para Fase 3.

---

## Decisiones de scope (explícitas, para que no se pierdan)

| Tema                          | Decisión                                 | Razón                                                                                     |
| ----------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Big-Bang Reset                | Aceptado                                 | Reset testnet4 sin piedad; tokens testnet4 desechables. Spec sección 2.                   |
| babtc-v2 firma                | HMAC-SHA256 (no Schnorr)                 | Mantiene wasm pequeño; criptográficamente real; signer Node.js lo produce fácil. Spec D6. |
| `work_proof` op               | Desactivado (`_ => false`)               | No hay NFTs legacy en reset. Spec D2.                                                     |
| `block_time` en MiningWitness | Añadido (option A)                       | El challenge no embebe tiempo; opción más explícita.                                      |
| `createNFTWorkSpell`          | Dejado (client-side, sin callers worker) | Consistencia con sibling `createNFTWorkProofSpell`.                                       |
| EZKL (Fase 7 de B)            | Deferred a sub-proyecto D                | 10-12 sesiones; no hay PoUW-IA que cerrar. Spec D3.                                       |
| Mobile stores                 | Post-launch web                          | Spec D4.                                                                                  |

---

## Lo que NO hay que tocar (funciona y está verificado)

- Contrato NFT genesis-babies (`work` + `settle` + `work_proof` desactivado) — no romper.
- `bro-reward.ts` (canónica) — no tocar.
- `block-observer.ts` — funciona.
- `validateMiningProof` en `apps/workers/src/lib/proof-validation.ts` — correcta.
- Stack Docker regtest — funciona.
- CI workflow existente (ts, contracts, secret-scan) — funciona; solo se AÑADIÓ contract-vk-check.
