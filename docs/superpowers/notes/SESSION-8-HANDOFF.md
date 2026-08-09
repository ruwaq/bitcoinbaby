# Handoff — Sesión 8 → Sesión 9

> **Fecha:** 2026-08-09
> **Branch:** `feat/subproyecto-d-nft-hardening` (parte de `8803964` sub-proyecto C)
> **Main al iniciar sesión:** `8803964` (sub-proyecto C Fases 0-2 done)
> **Estado:** Sub-proyecto D **Fases D1 + D2 IMPLEMENTADAS y verificadas**. Fases D3-D5 pendientes (worker unification + marketplace + precio/docs). El bloqueo del prover (decisión D1 operativa del spec C) sigue vigente — no bloquea D3-D5 porque son trabajo de código.

---

## Dónde estamos

```
Sub-proyecto C (mainnet launch) — Fases 0-2 done, 3-5 bloqueadas por cuota prover
Sub-proyecto D (NFT hardening + venta) — ESTE
   ├─ Fase D1 — Fix contrato genesis-babies (PoW replay)  ✅ HECHO (esta sesión)
   ├─ Fase D2 — SPARK_START_TIME (mining emisión)         ✅ HECHO (esta sesión)
   ├─ Fase D3 — Unificar flujo de minteo (worker)         ⏳ PENDIENTE (la grande)
   ├─ Fase D4 — Fix marketplace (dust + hardening)        ⏳ PENDIENTE
   └─ Fase D5 — Precio + docs + handoff                   ⏳ PENDIENTE
```

**Spec completo:** `docs/superpowers/specs/2026-08-09-subproyecto-c-mainnet-launch-design.md`
(falta spec formal del sub-proyecto D — el plan aprobado está en el contexto de esta sesión, ver sección "Plan D" abajo).

---

## Lo que SÍ está completo y verificado (esta sesión)

### Fase D1 — Fix contrato genesis-babies (PoW replay) ✅

**Commit:** `9424882`

La auditoría encontró que el cierre del exploit C3 (sub-proyecto C Fase 1) era **cosmético**: el op `work` ya no aceptaba `xp_gain` libre, PERO el `challenge` del witness seguía siendo input libre, sin ligar al NFT ni al avance de bloque. Un atacante podía minar **un solo PoW barato** (dificultad 16, trivial) y reusarlo infinitamente para inflar XP en todos sus NFTs. Mismo impacto económico que C3.

Fixes aplicados en `packages/bitcoin/contracts/genesis-babies/src/lib.rs`:

- **D1.1 (anti-replay bloque):** `validate_work` ahora exige `wk.current_block > old.last_work_block` (antes solo chequeaba igualdad witness↔output con `!=`). Patrón copiado de `validate_settle:788`.
- **D1.2 (challenge ligado al NFT):** el contrato reconstruye el challenge esperado como `format!("{}:{}", old.token_id, old.work_count)` y rechaza si `wk.challenge != expected_challenge`. Un PoW minado para un NFT ya no sirve para otro, ni para el siguiente work del mismo NFT.
- **D1.3 (cap dificultad):** constante `MAX_DIFFICULTY: u32 = 32`, rechaza `difficulty` fuera de `[MIN_DIFFICULTY_FOR_XP, MAX_DIFFICULTY]` antes del `verify_pow`. Iguala el `MAX_DIFFICULTY` del worker (`proof-validation.ts:14`).
- **D1.4 (doc):** `validate_mint` ahora declara que la unicidad de `token_id` es responsabilidad off-chain (Charms es stateless sobre ids globales).
- **D1.5 (heritage):** `is_valid_initial_state` valida `heritage <= 4`.

**Tests:** 4 integration tests nuevos + 3 existentes actualizados al challenge canónico. **27 tests verde** (23 + 4).

**VK rotation:** al cambiar `lib.rs`, el WASM recompilado tendrá nuevo VK. Esto orfana tokens testnet4 (aceptable, Big-Bang Reset). El binario embebido `apps/workers/src/lib/nft-contract-binary.ts` debe regenerarse (follow-up #1 SESSION-7, NO hecho en esta sesión).

### Fase D2 — SPARK_START_TIME (emisión mining) ✅

**Commit:** `6d9dd1a`

El análisis económico reveló que la emisión de SPARK por minado daba **~cero tokens**. Causa: el contrato `babtc` y `bro-reward.ts` usaban `BRO_START_TIME = 1_756_830_000` (2025-09-02, genesis real de BRO). SPARK lanza ~1 año después → el halving ya llevaba ~25 períodos (divisor 2^25 ≈ 33M) → emisión efectiva cero.

Fixes:

- Renombrado `BRO_START_TIME` → `SPARK_START_TIME` en contrato babtc + `bro-reward.ts` + todos los consumidores (`token.ts`, `charms/index.ts`, `index.ts`, `bro-reward.test.ts`).
- **Placeholder `1_758_102_000` (2026-09-15T00:00:00Z)** con `TODO(deploy)` documentado. **EL OPERADOR DEBE setear la fecha real de genesis mainnet antes del deploy.** Debe coincidir EXACTAMENTE entre contrato y signer, si no cada mining spell es rechazado.
- History documentada en `bro-reward.ts` para que un futuro dev no vuelva a poner el valor de BRO.

**Verify:** 7 cargo tests babtc verde + 563 pnpm tests bitcoin verde + typecheck limpio en 7 packages.

---

## Modelo económico (definido esta sesión, pendiente de docs en D5)

El producto replica el modelo de BRO token:

- **Mining SPARK:** usuario mina PoW (gratis para el operador), paga gas, el proof lo paga el operador PERO el contrato EMITE SPARK nuevo para el minero (no sale del bolsillo del operador, igual que Bitcoin emite BTC). Sostenible si SPARK tiene valor de mercado.
- **Venta NFT:** usuario paga precio en sats (default propuesto: **5.000 sats = ~$3**), cubre gas + proof + margen. Con batch minting el costo proof/NFT es ~$0.005.
- **Marketplace P2P:** usuarios comercian entre ellos con PSBT atomic swap (ya implementado en `listing.ts` + `buy.ts`).

**Margen operacional estimado:** +$52/usuario/año (fees de uso del juego). Mining se financia con emisión, no es costo del operador.

---

## Bugs CRÍTICOS pendientes (auditoría worker, NO arreglados todavía)

La auditoría del worker encontró **7 bugs CRÍTICOS** en el flujo de minteo/venta actual. Se cierran en Fase D3-D4. Resumen honesto: **hoy se pueden mintear NFTs gratis ($0.20 vs $3) con traits truchos (mythic siempre)**.

| #    | Severidad    | Hallazgo                                                                   | Archivo                                        | Fase fix         |
| ---- | ------------ | -------------------------------------------------------------------------- | ---------------------------------------------- | ---------------- |
| #1   | CRÍTICO      | Precio NFT (50k sats) nunca cobrado; `nft-sale.ts` no importado por worker | `nft-sale.ts:22` + ausencia en `apps/workers/` | D3               |
| #2   | CRÍTICO      | Traits NFT (DNA, bloodline, rarity) manipulables client-side en `/prove`   | `reserve.ts:323` + `middleware.ts:202`         | D3               |
| #3   | CRÍTICO      | `/prove` no valida reserva ni ownership del tokenId                        | `reserve.ts:332`                               | D3               |
| #4   | CRÍTICO      | Race condition en `/confirm` (sin MULTI/atomicidad Redis)                  | `confirm.ts:55-97`                             | D3               |
| #5   | CRÍTICO      | Sin replay protection de txid en `/confirm`                                | `confirm.ts:43`                                | D3               |
| #6   | CRÍTICO      | `/confirm` confía en txid/traits sin verificar on-chain                    | `confirm.ts:70-86`                             | D3               |
| Dust | CRÍTICO func | NFT minteado a 330 sats pero `/buy` exige 546 → marketplace roto           | `nft-spell-utils.ts:36` vs `buy.ts:172`        | D4               |
| #7   | ALTO         | `/list` legacy sin firma de ownership on-chain                             | `listing.ts:245`                               | D4               |
| #8   | ALTO         | Colisión `/claim` (incr) vs `/confirm` (random ID)                         | `claim.ts:110`                                 | D3 (unificación) |
| #9   | ALTO         | `/claim` no actualiza `nft:all-tokens` → NFTs invisibles                   | `claim.ts:151`                                 | D3 (unificación) |
| #10  | MEDIO        | `/migrate-index`, `/update-attempt` sin auth                               | `confirm.ts:381`, `reserve.ts:256`             | D4               |
| #11  | MEDIO        | Unlist sin signature permitido                                             | `listing.ts:353`                               | D4               |

**Causa raíz de 5 de los 7 críticos:** hay DOS rutas de minteo divergentes. `/prove`+`/confirm` (inseguras, confían en el cliente) vs `/claim` (segura, server-side). La Fase D3 unifica todo en un solo `/mint` seguro basado en el patrón de `/claim`.

---

## Plan D (aprobado, pendiente de ejecución D3-D5)

### Fase D3 — Unificar flujo de minteo (worker) ⏳ LA GRANDE

**Archivos:** `apps/workers/src/routes/nft/{reserve,confirm,claim,middleware}.ts`, `services/nft-minting-simple.ts`, `routes/nft.ts`, `wrangler.toml`, `package.json`

1. **Eliminar rutas inseguras** `/prove` (`reserve.ts:332-437`) y `/confirm` (`confirm.ts:43-111`). Eliminar schemas `proveNftSchema`, `confirmNftSchema`.
2. **Crear `POST /mint` server-side seguro** combinando lo seguro de ambos mundos:
   - Pago validado on-chain (output al NFT_TREASURY ≥ precio). Patrón `buy.ts:184-202`. Precio via env `NFT_MINT_PRICE_SATS` (default 5000).
   - Traits server-side determinísticos (`createSeededRandom(txid)` + distribución fairness). Patrón `claim.ts:114-130`. Cliente NO manda traits.
   - Verificación on-chain completa (fetch mempool, `status.confirmed`, OP_RETURN `434841524d`). Patrón `claim.ts:44-107`.
   - Atomicidad anti-race (`setnx("nft:minting:{txid}")`). Patrón `buy.ts:60-76`.
   - Anti-replay por txid (`nft:claimed:{txid}`). Patrón `claim.ts:153`.
   - TokenId server-side (`incr("nft:minted:count")`).
3. **Actualizar `routes/nft.ts`** para montar `/mint` y desmontar `/prove`, `/confirm`, `/claim`.
4. **Añadir `NFT_MINT_PRICE_SATS` + `NFT_TREASURY_ADDRESS` a `wrangler.toml`** (dev + prod). Hoy NO existen (`grep NFT_TREASURY = 0`). Treasury real se setea al deploy.
5. **Añadir dependencia `@bitcoinbaby/bitcoin` a `apps/workers/package.json`** para poder importar `treasury.ts` y `nft-sale.ts` canónicos (hoy no la tiene → constantes duplicadas en 4 lugares).
6. **Tests:** integration test (mint sin pago rechazado, pago < precio rechazado, tx no confirmada rechazada, replay txid rechazado, traits siempre server-side).

### Fase D4 — Fix marketplace (dust + hardening) ⏳

1. **Unificar dust a 330** (`buy.ts:172,178` usa `546`, debe ser `NFT_DUST_SATS`). Centralizar constante en 1 lugar, eliminar duplicados (`cbor-spell.ts:584`, `config/claim.ts:38`, `claim-minting-service.ts:19`).
2. **Auth en endpoints admin** (`/migrate-index`, `/update-attempt`) via middleware `ADMIN_TOKEN` env.
3. **Endurecer `/list` legacy** (requerir firma Schnorr ownership, quitar backward-compat sin signature `listing.ts:353-359`).
4. **`/mint` nuevo actualiza `nft:all-tokens`** (cierre #9, copiar de `confirm.ts:93-97`).
5. Tests: NFT minteado a 330 puede venderse vía `/buy`; listing sin firma rechazado.

### Fase D5 — Precio + docs + handoff ⏳

1. **Setear precio mint en $3 (5.000 sats)** en `NFT_MINT_PRICE_SATS`.
2. **Crear `docs/ECONOMICS.md`** con modelo económico (schedule emisión SPARK, pricing NFT, fees marketplace, flujo caja operador).
3. **Actualizar `NFT_DEPLOYMENT_RUNBOOK.md`** con flujo `/mint`.
4. **Handoff SESSION-9.**

---

## Dónde arranca la próxima sesión

```
1. git checkout feat/subproyecto-d-nft-hardening   (D1+D2 ya commiteados)
2. Leer este handoff (docs/superpowers/notes/SESSION-8-HANDOFF.md)
3. Arrancar Fase D3 (unificar flujo de minteo worker) — la más grande
```

**Contexto clave para D3:**

- El modelo seguro a replicar es `/claim` (`apps/workers/src/routes/nft/claim.ts:31-166`): genera traits server-side con `createSeededRandom(txid)` + distribución fairness + verifica on-chain + atomicidad.
- El patrón de verificación de pago on-chain está en `/buy` (`buy.ts:184-202`): busca output al treasury ≥ precio.
- El patrón de lock anti-race está en `/buy` (`buy.ts:60-76`): `setnx` con TTL.
- Patrones de helpers: `fetchWithTimeout` + `EXTERNAL_API.MEMPOOL_TESTNET4` + `TX_LOOKUP_TIMEOUT_MS` en `lib/helpers.ts:309-315`.
- `/claim` usa `createSeededRandom` de `apps/workers/src/lib/deterministic-random.ts` (xorshift32, no CSPRNG, pero seguro porque seed = txid on-chain confirmado).

---

## Commits del branch (2, esta sesión)

```
6d9dd1a fix(mining): SPARK_START_TIME propio, deja de heredar clock de BRO (D2)
9424882 fix(contracts): close PoW replay in genesis-babies work op (D1)
```

Branch base: `feat/subproyecto-c-fases-0-2` (`8803964`).

---

## ⚠️ FOLLOW-UPS CONOCIDOS (NO bloqueantes para D3, pero importantes)

### 1. Regenerar binarios WASM embebidos (arrastrado de SESSION-7)

Los 3 binarios WASM embebidos (`babtc-contract-binary.ts`, `babtc-v2-contract-binary.ts`, `nft-contract-binary.ts`) están **stale** respecto al source. Ahora CON MÁS RAZÓN: D1 cambió `genesis-babies/src/lib.rs` → nuevo VK. Acción: regenerar con `cargo build --release --target wasm32-wasip1` + `charms app vk` y commitear. Hacerlo DESPUÉS de D3-D5 (o como último commit antes del PR).

### 2. SPARK_START_TIME fecha real (decisión operativa)

El placeholder `1_758_102_000` (2026-09-15) debe reemplazarse por la fecha real de genesis mainnet de SPARK antes del deploy. Debe coincidir EXACTAMENTE entre contrato (`babtc/src/lib.rs`) y signer (`bro-reward.ts`). TODO(deploy) documentado en ambos.

### 3. NFT_TREASURY_ADDRESS (decisión operativa)

El worker no sabe dónde mandar BTC de ventas NFT (`grep NFT_TREASURY = 0` en wrangler.toml). Definir al deploy. Hoy existe `NFT_TREASURY_TESTNET4` en `packages/bitcoin/src/config/treasury.ts:71` pero el worker no lo importa (no tiene la dependencia `@bitcoinbaby/bitcoin`).

---

## Lo que NO hay que tocar (funciona y está verificado)

- `validate_settle` (patrón positivo que D1 imitó)
- `validate_level_up`, `nft_state_preserved`, transfers
- `minedAmountBro` fórmula (solo se renombró START_TIME en D2)
- `batch-minting.ts` (palanca de optimización, se activa en Fases 3-5 del spec C)
- `block-observer.ts`, `validateMiningProof`, `proof-validation.ts`
- Stack Docker regtest, CI workflow existente
