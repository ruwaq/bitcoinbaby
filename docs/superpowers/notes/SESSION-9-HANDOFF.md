# Handoff — Sesión 9 → Sesión 10

> **Fecha:** 2026-08-09
> **Branch:** `feat/subproyecto-d-nft-hardening`
> **Main al iniciar sesión:** `8803964` (sub-proyecto C Fases 0-2 done)
> **Estado:** Sub-proyecto D **COMPLETO (Fases D1-D6)**, incluyendo la migración web al flujo `/mint`. Todos los bugs críticos del catálogo cerrados con tests. El código está listo para PR; faltan solo los follow-ups operativos (binarios WASM, decisiones de deploy) y el hardening de `/unlist` con firma (sesión separada).

---

## Dónde estamos

```
Sub-proyecto C (mainnet launch) — Fases 0-2 done, 3-5 bloqueadas por cuota prover
Sub-proyecto D (NFT hardening + venta) — COMPLETO ✅
   ├─ Fase D1 — Fix contrato genesis-babies (PoW replay)        ✅ SESSION-8
   ├─ Fase D2 — SPARK_START_TIME (mining emisión)               ✅ SESSION-8
   ├─ Fase D3 — Unificar flujo de minteo (worker)               ✅ SESSION-9
   ├─ Fase D4 — Fix marketplace (dust + hardening)              ✅ SESSION-9
   ├─ Fase D5 — Precio + docs + handoff                         ✅ SESSION-9
   └─ Fase D6 — Migración web al flujo /mint unificado          ✅ SESSION-9 (añadida tras hallar el frontend roto)
```

**Spec completo:** `docs/superpowers/specs/2026-08-09-subproyecto-c-mainnet-launch-design.md`
**Modelo económico:** `docs/ECONOMICS.md` (nuevo, esta sesión)
**Runbook mint:** `docs/NFT_DEPLOYMENT_RUNBOOK.md` (actualizado con flujo /mint)

---

## Lo que se hizo esta sesión (SESSION-9)

### Decisión arquitectónica clave

El handoff SESSION-8 sugería "replicar `/claim`" para el `/mint` unificado.
**Eso era incorrecto:** `/claim` no invoca al prover Charms, así que sus NFTs
no existen on-chain y **no pueden venderse** vía `/buy` (que exige un UTXO
on-chain del NFT). La unificación **endurece** el flujo del prover en vez de
eliminarlo: modelo de transacción atómica donde una sola tx Bitcoin es
simultáneamente el pago (al treasury) y el mint (coin NFT al comprador).

### Fase 0 — Prereqs compartidos (commit `9a9d277`)

- Dep workspace `@bitcoinbaby/bitcoin` añadida a `apps/workers` (antes ausente).
- `NFT_MINT_PRICE_SATS` (5000) + `NFT_TREASURY_ADDRESS` (testnet4 default) en wrangler.toml dev+prod + tipo `Env`.
- `NFT_DUST_SATS` unificado a fuente canónica única (`nft-spell-utils.ts:36`); `cbor-spell.ts:584` ahora reexporta.

### Fase D3 — Unificar minteo (commits `3924399`, `064e4a9`, `775a561`)

- **D3.3:** `buildMintSpell` extendido para emitir spell de 2 coins (NFT dust + pago treasury) cuando `treasuryAddress`+`priceSats` están presentes. Backward-compat: sin esos campos produce el spell legacy de 1 coin.
- **D3.1+D3.2:** Nuevo `apps/workers/src/routes/nft/mint.ts` con `POST /mint/prepare` y `POST /mint/finalize`.
- **D3.4:** Eliminados `POST /reserve`, `/prove`, `/release/:tokenId` (reserve.ts), `POST /confirm/:tokenId` (confirm.ts), y el archivo entero `routes/nft/claim.ts`. Limpiados schemas huérfanos (`reserveNftSchema`, `confirmNftSchema`, `claimNftSchema`, `proveNftSchema`).

### Fase D4 — Marketplace hardening (commit `77ac2dc`)

- **D4.1:** `buy.ts` ahora chequea el output NFT contra `NFT_DUST_SATS` (330) en vez del hardcode `546`. **Esto es lo que rompía toda reventa** (NFTs se mintean a 330, buy exigía 546).
- **D4.2:** `/migrate-index` ahora requiere header `X-Admin-Key` (constantTimeEqual vs `ADMIN_KEY`). `/update-attempt` **NO** se gatedó — es un endpoint de tracking que el browser llama en cada paso del mint (ver fix `389aa23` abajo).
- **D4.3 (revertido luego):** `/unlist` se endureció para requerir firma Schnorr, pero se revertió porque el `signMessage` del wallet es un placeholder ECDSA roto que no produce Schnorr BIP-340 → el endpoint quedaba inutilizable. Ahora la firma es opcional (se verifica si está, se loguea warning si no). Bug #11 reabierto hasta que el follow-up signMessage aterrice.

### Fase D5 — Docs (esta sesión)

- `docs/ECONOMICS.md` creado (schedule emisión SPARK, pricing NFT, fees, flujo caja).
- `docs/NFT_DEPLOYMENT_RUNBOOK.md` actualizado con flujo `/mint/prepare`+`/mint/finalize`.
- Este handoff.

---

## Bugs cerrados (catálogo SESSION-8)

| #    | Severidad    | Estado     | Cierre                                                                                                                                                                                  |
| ---- | ------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1   | CRÍTICO      | ✅         | Pago atómico en misma tx que mint — no se puede mintear sin pagar                                                                                                                       |
| #2   | CRÍTICO      | ✅         | Traits server-side desde txid; cliente nunca los manda                                                                                                                                  |
| #3   | CRÍTICO      | ✅         | `/prepare` verifica ownership del fundingUtxo on-chain                                                                                                                                  |
| #4   | CRÍTICO      | ✅         | Locks SETNX por funding outpoint (/prepare) y spell txid (/finalize)                                                                                                                    |
| #5   | CRÍTICO      | ✅         | Anti-replay por spell txid (`nft:minted:txid:{spellTxid}`)                                                                                                                              |
| #6   | CRÍTICO      | ✅         | `/finalize` verifica spell tx on-chain (confirmed + outputs)                                                                                                                            |
| Dust | CRÍTICO func | ✅         | buy.ts usa NFT_DUST_SATS (330) consistente con mint                                                                                                                                     |
| #7   | ALTO         | ⚠️ parcial | `/list` legacy sin firma on-chain — NO tocado esta sesión (D4.3 cerró unlist, no list)                                                                                                  |
| #8   | ALTO         | ✅         | tokenId server-side vía `incr`                                                                                                                                                          |
| #9   | MEDIO        | ✅         | `/finalize` escribe `nft:all-tokens`                                                                                                                                                    |
| #10  | MEDIO        | ✅ parcial | Auth ADMIN_KEY en `/migrate-index`. `/update-attempt` quedó público (es tracking del browser, no admin); hardening real requiere validar que el attemptId pertenezca al caller — futuro |
| #11  | MEDIO        | ⚠️ revert  | D4.3 lo cerró exigiendo firma Schnorr, pero se revertió (el `signMessage` del wallet es ECDSA placeholder roto). Firma ahora opcional; bug reabierto hasta follow-up signMessage        |

**Pendiente honesto:** bug #7 (`/list` legacy sin verificación on-chain de ownership del UTXO listado) NO se cerró. El plan D4.3 original solo apuntaba a `/unlist`. Es trabajo futuro de seguridad, no bloquea el flujo normal.

---

## Estado de verificación

- **Tests globales:** 1309 verde (`pnpm -r test`). shared 34, bitcoin 563, core 473, workers 177, ui 40, web 22.
- **Typecheck:** limpio en 7 packages (`pnpm -r typecheck`).
- **Lint workers:** 0 errores. **Lint web:** 17 errores preexistentes en `useVirtualBalance.ts` y otros archivos NO tocados esta sesión (mi migración redujo warnings de 15 a 12).
- **Working tree:** limpio al final de la sesión.

---

## Commits de la sesión (10, esta branch)

```
56ef6fd revert(nft): make /unlist signature optional again (D4.3 rollback)
c94f64e feat(web): migrate NFT mint UI to unified /mint flow (D6)
9b6b7bc refactor(core): prepareMint + finalizeMint replace 5 legacy NFT methods (D6.1-D6.3)
389aa23 fix(nft): revert admin gate on /update-attempt (regression from D4.2)
d3cd6c4 docs(nft): ECONOMICS + /mint runbook + SESSION-9 handoff (D5)
77ac2dc feat(marketplace): fix dust mismatch + admin auth + signature-required unlist (D4)
775a561 refactor(nft): remove legacy reserve/prove/confirm/claim routes (D3.4)
064e4a9 feat(nft): unified /mint/prepare + /mint/finalize routes (D3.1, D3.2)
3924399 feat(minting): atomic NFT+treasury spell output (D3.3)
9a9d277 chore(workers): NFT mint shared prereqs for D3 (D0)
```

Branch base: `feat/subproyecto-c-fases-0-2` (`8803964`). Total branch: 12 commits (D1+D2 SESSION-8 + D0+D3+D4+D5+D6+fix-D4.2+revert-D4.3 SESSION-9).

---

## ⚠️ FOLLOW-UPS (NO bloqueantes para PR, pero importantes)

### 0. Implementar `signMessage` Schnorr BIP-340 + re-endurecer `/unlist` (de una sesión entera)

El backend `/unlist` y la verificación Schnorr (`lib/crypto.ts:verifySchnorrSignature`) **ya funcionan** — lo que falta es el lado wallet. Hallazgo al investigar: `signMessage` YA existe en el `WalletProvider` (`useWalletProvider.ts:55`, `packages/bitcoin/src/providers/*/`), PERO:

- **Internal wallet** (`packages/bitcoin/src/wallet.ts:249`): es un **placeholder ECDSA roto** (el código dice "For now, return a placeholder"), devuelve base64 sin `publicKey`. No sirve.
- **Unisat**: usa BIP-322-simple.
- **Xverse**: su propio formato.
- **`SignedMessage` type** (`providers/types.ts:45`): tiene `signature` + `address` + `message` pero **NO** `publicKey`, que es lo que exige el schema `unlistBodySchema`.

Trabajo real (no es cablear): (a) implementar Schnorr BIP-340 con taproot tweak en el internal wallet, (b) añadir `publicKey` al type `SignedMessage`, (c) decidir cómo manejar Unisat/Xverse (¿adaptar su salida a Schnorr, o marcarlos como no-soportados para unlist?), (d) cablear al `useWalletStore` + `useMarketplace.unlistNFT`, (e) re-endurecer el schema a `.required()`. Bug #11 (MEDIO, sin pérdida de fondos) queda abierto mientras tanto.

### 1. Regenerar binarios WASM embebidos (arrastrado de SESSION-7, MÁS urgente ahora)

D1 (SESSION-8) cambió `genesis-babies/src/lib.rs` → nuevo VK. Los 3 binarios WASM embebidos (`babtc-contract-binary.ts`, `babtc-v2-contract-binary.ts`, `nft-contract-binary.ts`) están **stale**. Acción:

```sh
cd packages/bitcoin/contracts/genesis-babies
cargo build --release --target wasm32-wasip1
charms app vk target/wasm32-wasip1/release/genesis_babies.wasm
# pegar VK + binario en apps/workers/src/lib/nft-contract-binary.ts
```

Hacerlo como **último commit antes del PR**.

### 2. Integración web del nuevo flujo `/mint` (NUEVO, esta sesión)

El frontend (`apps/web`) probablemente llama aún a `/reserve`+`/prove`+`/confirm` que ya no existen. **No busqué ni toqué el web esta sesión** — estaba fuera del alcance aprobado (plan D3-D5 era workers + docs). Próxima sesión: grep de `reserve`/`prove`/`confirm`/`claim` en `apps/web/src` y migrar al flujo `/mint/prepare`+`/mint/finalize`.

### 3. Bug #7: `/list` legacy sin verificación on-chain

`listing.ts:224` (`POST /list`) valida ownership solo vía `nft:owned` (indexer), no verifica on-chain que el vendedor controle el UTXO listado. Trabajo futuro de hardening.

### 4. Decisiones operativas de deploy (NO código)

- **`SPARK_START_TIME`** real (placeholder `1_758_102_000` = 2026-09-15). Debe coincidir entre `babtc/src/lib.rs` y `bro-reward.ts`.
- **`NFT_TREASURY_ADDRESS`** mainnet real (placeholder testnet4 en wrangler).
- **Cuota prover** (Succinct credits vs self-host). Bloquea el genesis mint real.

---

## Dónde arranca la próxima sesión

Opciones ordenadas por prioridad lógica:

1. **Follow-up #1 (binarios WASM)** — rápido, desbloquea cualquier test E2E real. Último commit antes de mergear el PR del sub-proyecto D.
2. **Follow-up #0 (signMessage Schnorr + re-endurecer /unlist)** — una sesión entera. Bug #11 (MEDIO) queda abierto mientras tanto; el marketplace unlist funciona (sin firma) y no hay pérdida de fondos.
3. **Bug #7** (`/list` legacy sin verificación on-chain) — hardening adicional, no bloqueante.
4. **E2E reales en testnet4** — los e2e (`apps/web/e2e/nft-minting.spec.ts`) están reescritos contra `/mint` pero requieren worker deploy + fondos para correr de verdad.
5. **E2E reales en testnet4** — los e2e (`apps/web/e2e/nft-minting.spec.ts`) están reescritos contra `/mint` pero requieren worker deploy + fondos para correr de verdad.

**Contexto clave para cualquiera de estos:**

- El flujo canónico de minteo ahora es `POST /mint/prepare` → sign+broadcast → `POST /mint/finalize` (backend `routes/nft/mint.ts`, frontend `apps/web/src/hooks/useMintNFT.ts`).
- El modelo de pago es atómico: misma tx Bitcoin = mint + pago al treasury.
- Traits son server-side, seed = `{fundingTxid}:{tokenId}`.
- `docs/ECONOMICS.md` tiene todos los números.
- `docs/NFT_DEPLOYMENT_RUNBOOK.md` tiene el procedimiento completo (génesis + mint post-génesis).

---

## Lo que NO hay que tocar (funciona y está verificado)

- `validate_settle`, `validate_level_up`, `validate_work` (D1 cerró replay PoW).
- `proof-validation.ts`, `block-observer.ts`.
- Schedule emisión SPARK (solo START_TIME es placeholder).
- Stack Docker regtest, CI.
- El servicio `NFTMintingServiceSimple` (extendido en D3.3, backward-compat).
