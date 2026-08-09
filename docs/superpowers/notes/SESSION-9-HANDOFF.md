# Handoff — Sesión 9 → Sesión 10

> **Fecha:** 2026-08-09
> **Branch:** `feat/subproyecto-d-nft-hardening` → **MERGED a `main` via PR #7** (merge commit `c166db4`, 2026-08-09).
> **Main al iniciar sesión:** `8803964` (sub-proyecto C Fases 0-2 done) → **Main al cerrar:** `c166db4`.
> **Estado:** Sub-proyecto D **COMPLETO (Fases D1-D6) y MERGEADO a main**, incluyendo la migración web al flujo `/mint`. Todos los bugs críticos del catálogo cerrados con tests. Quedan los follow-ups operativos (binarios WASM — ver §1, decisiones de deploy) y el hardening de `/unlist` con firma (sesión separada).

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

### 1. Binarios WASM embebidos: stale vs source, ALINEADOS vs on-chain (NO regenerar suelto)

> **Actualizado 2026-08-09 (post-PR #7 merge)** tras verificación empírica.
> La versión anterior de esta sección llamaba al regenerado "fix rápido / último commit antes del PR".
> **Eso es falso y peligroso** — medí los 3 builds y el resultado lo desmiente. No regenerar suelto.

**Medición empírica (cargo clean + build --release --target wasm32-wasip1 sobre source actual de `main`):**

| Contrato             | VK embebido (bytes)     | VK cargo build limpio (bytes) | ¿Stale vs source? |
| -------------------- | ----------------------- | ----------------------------- | ----------------- |
| babtc v1             | `ab70796e...` (88,233)  | `3f0fcafe...` (259,297)       | ✗ SÍ              |
| babtc v2             | `bad3cb4e...` (250,242) | `8ffa21e1...` (263,688)       | ✗ SÍ              |
| genesis-babies (NFT) | `0d9483a7...` (264,108) | `2501737a...` (278,766)       | ✗ SÍ              |

**Los 3 están stale vs el source actual.** Pero los 3 VK embebidos son los mismos que usan
**todos los consumers** (`wrangler.toml:86,104,153,171`, `batch-minting.ts:100`,
`config/testnet4.ts`) y — críticamente — el babtc v1 (`ab70796e...`) es el VK del contrato
**desplegado on-chain en testnet4** (genesis `b3deba0743...:0`, block ~75000, 2026-02-18;
ver `docs/audits/DEPLOYMENT.md:23`).

**Consecuencia: regenerar los binarios sin redeployar on-chain ROMPE el runtime.** Los
nuevos VK (`3f0fcafe/8ffa21e1/2501737a`) producirían appRefs (`t/<appId>/<vk>`) que la chain
no reconoce → todas las spells se rechazan. Esto es justo el riesgo que `VK_RECONCILIATION.md:61`
liga al **reset de testnet4**: _"Tras el reset, el nuevo deployment define el VK canónico y
todos los consumidores se alinean"_.

**Acción correcta (bloqueada por follow-up #3):** NO regenerar aislado. La regeneración va
**bundled con el redeploy on-chain + reset testnet4** (follow-up #3). Hasta entonces, los
binarios stale están _intencionalmente_ alineados con lo on-chain — es lo correcto para que
producción funcione.

**Guardián local IMPLEMENTADO (Fase 0.3 de `VK_RECONCILIATION.md`):** `scripts/verify-vks.sh`

- hook `.husky/pre-push` + `pnpm verify:vks`. El hook solo corre cuando un push toca
  `packages/bitcoin/contracts/*/src/` y es **advisory** (reporta, no bloquea — respeta que el
  stale actual es intencional). Modo `--strict` para CI/release. NOTA: GitHub Actions está
  deshabilitado en el repo (`actions/permissions: enabled=false`), así que el job
  `contract-vk-check` de `ci.yml` no corre — el guardián local es lo que protege hoy. Cuando se
  rehabilite Actions + se haga el redeploy on-chain, el job de CI debe invocar
  `scripts/verify-vks.sh --strict` para reusar la lógica (no duplicar).

**Datos probatorios del build limpio** (reproducibles con `cargo clean && cargo build --release
--target wasm32-wasip1` en cada `packages/bitcoin/contracts/<contrato>`):

```
babtc/target/.../babtc-contract.wasm           259297 b  sha256=3f0fcafea6303322ee29acaa39ee8da69f3dc3fee68a77a3d897bed745f9ebc8
babtc-v2/target/.../babtc-v2-contract.wasm     263688 b  sha256=8ffa21e1702455e7464e003a276eabb9a5e06b8c1948c3e317a67c3447536706
genesis-babies/target/.../genesis-babies.wasm  278766 b  sha256=2501737a1bd73549677f276e0c93ce87328b076cfe1cacd9f493b50c7f435ae2
```

### 2. Integración web del nuevo flujo `/mint` (NUEVO, esta sesión) — ✅ HECHO en D6

**✅ HECHO en D6 (commits `9b6b7bc` + `c94f64e`, merged via PR #7).** La migración web al flujo `/mint/prepare`+`/mint/finalize` quedó completa en esta misma sesión (D6). `useMintNFT.ts` reescrito, `useClaimNFT.ts` eliminado, `NFTMintFlow.tsx` migrado, e2e actualizados. Las rutas legacy `/reserve`+`/prove`+`/confirm`+`/claim` fueron eliminadas del backend en D3.4 (commit `775a561`). Esta sección se conserva solo como historial — no hay trabajo pendiente aquí.

### 3. Bug #7: `/list` legacy sin verificación on-chain

`listing.ts:224` (`POST /list`) valida ownership solo vía `nft:owned` (indexer), no verifica on-chain que el vendedor controle el UTXO listado. Trabajo futuro de hardening.

### 4. Decisiones operativas de deploy (NO código)

- **`SPARK_START_TIME`** real (placeholder `1_758_102_000` = 2026-09-15). Debe coincidir entre `babtc/src/lib.rs` y `bro-reward.ts`.
- **`NFT_TREASURY_ADDRESS`** mainnet real (placeholder testnet4 en wrangler).
- **Cuota prover** (Succinct credits vs self-host). Bloquea el genesis mint real.

---

## Dónde arranca la próxima sesión

Opciones ordenadas por prioridad lógica:

1. **Follow-up #1 (binarios WASM)** — **NO accionable suelto.** Verificados stale vs source pero alineados con lo on-chain (sección §1 arriba). La regeneración va bundled con el redeploy on-chain + reset testnet4 (follow-up #3). Lo único accionable aislado es añadir un CI check que detecte la divergencia. **No llamar a esto "fix rápido" — medir antes.**
2. **Follow-up #0 (signMessage Schnorr + re-endurecer /unlist)** — una sesión entera. Bug #11 (MEDIO) queda abierto mientras tanto; el marketplace unlist funciona (sin firma) y no hay pérdida de fondos.
3. **Bug #7** (`/list` legacy sin verificación on-chain) — hardening adicional, no bloqueante.
4. **E2E reales en testnet4** — los e2e (`apps/web/e2e/nft-minting.spec.ts`) están reescritos contra `/mint` pero requieren worker deploy + fondos para correr de verdad.

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
