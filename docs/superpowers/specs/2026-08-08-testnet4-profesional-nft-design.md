# Sub-proyecto A: Testnet4 Profesional — NFTs end-to-end

> **Fecha:** 2026-08-08
> **Estado:** Diseño — pendiente de aprobación
> **Alcance:** Sub-proyecto A de 3 (A: testnet4 profesional · B: hardening de seguridad · C: mainnet + launch)
> **Decisión del usuario:** "profesional, alinear a Charms actual, todo on-chain, uno a la vez"

---

## Contexto y por qué existe este spec

La verificación de production readiness sobre `main` (`725523f`) reveló que, aunque el **código** de NFTs/mining/wallet es sustancialmente completo, **no se puede vender ni mintear ningún NFT** porque:

1. `NFT_APP_ID = "0000...0000"` (placeholder) en `apps/workers/wrangler.toml:100,158` (dev y prod). El worker rechaza todo mint con HTTP 503 (`apps/workers/src/routes/nft/reserve.ts:361-373`).
2. El contrato NFT embebido (`genesis-babies/src/lib.rs`) es un **stub de 13 líneas** ("ultra-minimal debug") que acepta cualquier operación sin validar traits, rarity, supply ni evolución.
3. `BABTC_APP_ID` en wrangler es un valor falso de 66 chars (no es un SHA-256 válido de 64).
4. **No existe un proceso de deploy** reproducible de contratos Charms. El comando `charms app deploy` citado en `docs/MAINNET_DEPLOYMENT.md` **no existe** en el CLI instalado. El deploy real es un ritual manual no documentado.

**Objetivo del sub-proyecto:** dejar el flujo completo de NFTs (mint → evolución → marketplace → transfer) funcionando end-to-end en testnet4 con un **contrato on-chain real** validado, alineado a Charms v15 (actual), de forma que la validación sea fiel a lo que irá a mainnet.

---

## Decisiones de scope (explícitas)

| Decisión | Elección | Razón |
|---|---|---|
| Contrato NFT on-chain | **Completo**: traits + DNA + rarity + supply cap + evolución + work-proof | El usuario eligió "todo on-chain" para que testnet valide lo mismo que mainnet |
| Ciclo E2E en testnet4 | **Completo**: mint → work-proof → level-up → marketplace → transfer, todo on-chain | Validar solo mint+marketplace dejaría la evolución (lo más cambiado por `4ad993b`) sin probar E2E. `cargo test` no basta; hay que probar spells reales contra el prover |
| Versión Charms | **Migrar contrato NFT a v15** (SDK 15.0.0, CLI 15.0.0, prover ya v15) | Alinear a estado actual del protocolo. SDK 11 está 4 versiones atrás. VK format cambió en v15 |
| Supply cap del NFT | **Simple: validación de `token_id` en rango (1-10000)** en el contrato | Manager-NFT (patrón v15) fuerza re-desplegar el token SPARK = scope+riesgo extra. Va en sub-proyecto B/C |
| Token SPARK (BABTC) | **Mantener el actual** (app ID `87b5ecfb...`), solo arreglar config wrangler | El token funciona, los rewards van ahí. Migrarlo a v15 rompe lo que anda; va en sub-proyecto C |
| Base del contrato | **Revivir `90cee8b` + migrar a v15 + parchear**, NO escribir de cero | Arqueología git mostró contrato completo de 186 líneas, recuperable, con base sólida |

---

## Sección 1 — Migración Charms v11 → v15

### Estado de versiones (verificado contra crates.io + GitHub, 2026-08-08)

| Componente | Actual | Tenemos | Acción |
|---|---|---|---|
| charms-sdk (Rust) | **15.0.0** | 11.0.1 | Upgrade |
| charms CLI | **15.0.0** | 14.0.0 | Upgrade |
| Prover | v15.charms.dev ✅ LIVE | v15 | Sin cambio |

### Breaking changes v11 → v15 relevantes

1. **`charms_sdk::app_version!(N)` macro obligatorio** en todo contrato (expone `VERSION` + export Wasm `__app_version`).
2. **Rust edition 2024** requerido (`#[unsafe(no_mangle)]`).
3. **Spell VK format cambió a `[u8; 32]`** (PR #193) — CLI y prover deben estar ambos en v15.
4. **CLI: `sign` renombrado a `sign_and_submit`** (broadcast via ICP Bitcoin).
5. SP1 bumped a 6.2.1; v12/v13 deprecados por advisory de seguridad GHSA-63x8-x938-vx33.

La firma del contrato `app_contract(app, tx, x, w) -> bool` **NO cambia**.

### Acciones

- Upgrade CLI: rebuild desde `scripts/install-charms-cli.sh` (apunta a `CharmsDev/charms`, tag v15.0.0).
- Migrar `genesis-babies/Cargo.toml`: `charms-sdk = "15.0.0"`, `edition = "2024"`.
- Los contratos `babtc` y `babtc-v2` se **dejan en v11** (no se tocan en este sub-proyecto — el token se mantiene). Se migran en sub-proyecto C.

---

## Sección 2 — Contrato NFT profesional (genesis-babies)

### Origen

Revivir `git show 90cee8b:packages/bitcoin/contracts/genesis-babies/src/lib.rs` (186 líneas, contrato completo con validación de traits). Reducido a stub de 13 líneas en commit `80ad37e` (2026-03-09), disfrazado de "fix de PSBT".

### Qué enforceará on-chain

```rust
pub fn app_contract(app, tx, x, w) -> bool {
    check!(app.tag == NFT);
    match operation_from_witness(w) {
        "mint"       => validate_mint(app, tx, x),       // traits + DNA + rarity + estado inicial
        "work_proof" => validate_work_proof(app, tx, x), // workCount++, totalXp+=gain, lastWorkBlock
        "level_up"   => validate_level_up(app, tx, x),   // level+1, xp=0, evolutionCount++, cap 21
        "transfer"   => nft_state_preserved(app, tx),    // estado inmutable preservado
        _            => false,                            // operación desconocida → rechazar
    }
}
```

**`validate_mint` (endurecido):**
- **REQUIERE** public input con el estado del NFT (cierra el agujero del `90cee8b` que hacía `return true` si faltaba).
- `token_id` en rango `[1, 10000]` (supply cap simple).
- `dna`: 64 chars hex.
- `bloodline` ∈ {royal, warrior, rogue, mystic}.
- `baseType` ∈ {human, animal, robot, mystic, alien}.
- `rarity_tier` ∈ {common, uncommon, rare, epic, legendary, mythic}.
- Estado inicial: `level=1, xp=0, totalXp=0, workCount=0, evolutionCount=0`.
- Verifica que no hay NFTs en inputs (es génesis) y que hay exactamente uno en outputs.

**`validate_level_up` (nuevo, alineado a `4ad993b`):**
- `newLevel = oldLevel + 1`, `newLevel <= 21`.
- `newXp = 0`, `newEvolutionCount = oldEvolutionCount + 1`.
- **Sin burn de tokens** (decisión de `4ad993b`).
- Traits inmutables preservados.

**`validate_work_proof` (nuevo):**
- `newWorkCount = oldWorkCount + 1`.
- `newTotalXp = oldTotalXp + xpGain`.
- `newLastWorkBlock = currentBlock`.
- Traits y nivel preservados.

### Parcheos sobre el `90cee8b`

1. Añadir `charms_sdk::app_version!(1);`.
2. Cerrar el fallback `Ok(_) => return true` en `validate_mint`.
3. Añadir `validate_work_proof` y `validate_level_up` (no existían).
4. Mover `_ => true` a `_ => false` (rechazar operaciones desconocidas).
5. Tests Rust (`cargo test`) para cada operación.

### Build

`cargo build --release --target wasm32-wasip1` → `charms app vk` (v15) → regenerar `NFT_CONTRACT_BINARY` (base64) y `NFT_APP_VK` en `apps/workers/src/lib/nft-contract-binary.ts`.

---

## Sección 3 — Ritual de deploy reproducible

Hoy no existe. Hay que construirlo. Deployar un contrato Charms = genesis mint contra el prover → capturar genesis UTXO → computar `appId = SHA256("txid:vout")`.

### Entregables

- **`scripts/deploy-nft-contract.ts`** — orquesta:
  1. Pide funding UTXO de testnet4 (tu wallet con tBTC).
  2. Llama `POST https://v15.charms.dev/spells/prove` con spell genesis.
  3. Recibe `commitTxHex` + `spellTxHex`.
  4. Convierte raw TX → PSBT si hace falta, firma, broadcastea a testnet4.
  5. Lee genesis UTXO (`commitTxid:0`), computa `appId = SHA256("txid:vout")`.
  6. Actualiza `NFT_APP_ID` en `apps/workers/wrangler.toml` (dev+prod) y `packages/bitcoin/src/config/testnet4.ts`.
- **`docs/NFT_DEPLOYMENT_RUNBOOK.md`** — procedimiento paso a paso: requisitos (tBTC), ejecución, troubleshooting (version skew, raw TX vs PSBT), verificación post-deploy.

### Checkpoint de participación humana

El genesis mint real requiere **tu wallet testnet4 con fondos** y claves. El script lo automatiza pero la ejecución del mint inicial es un checkpoint que necesita tu participación. El spec lo marca explícito.

---

## Sección 4 — Hardening del flujo NFT E2E

| Componente | Archivo | Acción |
|---|---|---|
| Placeholder guard | `apps/workers/src/routes/nft/reserve.ts:361` | Se desbloquea al setear app ID real (sin cambio de código) |
| Spell mint (CBOR) | `apps/workers/src/services/nft-minting-simple.ts:207` | Verificar compatibilidad con contrato v15 y VK `[u8;32]` |
| **Spells work-proof + level-up** | `apps/workers/src/services/` (NO existen hoy) | **Implementar** — solo el mint existe en el worker. Crear `nft-evolution-service.ts` que genere los spells v15 de work-proof y level-up, alineados con `packages/bitcoin/src/charms/nft.ts` (que ya los tiene en TS para el cliente) |
| Rutas API evolución | `apps/workers/src/routes/nft/` | Verificar/crear endpoints para work-proof y level-up si no existen (mint está en reserve.ts, ¿evolution?) |
| BABTC_APP_ID falso | `apps/workers/wrangler.toml:85,143` | Setear real `87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b` |
| Config drift (3 app IDs) | wrangler + testnet4.ts + STATUS.md | Reconciliar a una fuente de verdad |
| Market listings | `apps/workers/src/routes/nft/listing.ts` | Verificar secrets Redis/Upstash en prod |
| Tests stale (33) | `packages/core/tests/{nft-bonus-provider,mint-to-mine,ai-integration}.test.ts` | Actualizar a nomenclatura Spark + economy post-`4ad993b` |

---

## Sección 5 — Criterios de aceptación (validación E2E en testnet4)

Todo debe pasar antes de declarar el sub-proyecto A completo:

1. Contrato genesis-babies compila en Charms v15, VK regenerado, WASM embebido en worker.
2. `cargo test` del contrato pasa (mint/work_proof/level_up/transfer).
3. Genesis mint ejecutado en testnet4, app ID real capturado y configurado.
4. **E2E real en testnet4 (ciclo completo)**:
   - mint → confirmado en mempool.space/testnet4 → aparece en colección
   - work-proof → XP acumulado, cambio de estado on-chain verificado
   - level-up → nivel incrementado, `evolutionCount++`, cambio on-chain verificado
   - list en marketplace → compra por otro usuario → transferencia on-chain verificada
5. Cada operación (mint/work_proof/level_up/transfer) validada por el contrato v15 (no solo por el prover).
6. 33 tests stale de core actualizados y pasando.
7. Worker redeployado (dev+prod) con configs correctas.
8. Runbook de deploy documentado y ejecutable.

---

## Sección 6 — Lo que se CORTA explícitamente (va en B/C)

- Manager-NFT / supply cap avanzado (sub-proyecto B/C)
- Migración del token SPARK a v15 (sub-proyecto C / mainnet)
- Auditoría externa de seguridad (sub-proyecto B)
- Mainnet deploy (sub-proyecto C)
- Mobile stores, CI/CD, migración tests MockClient
- Redeploy de Vercel (se hace como smoke test al final, no es deliverable del contrato)

---

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Version skew CLI v14 vs prover v15 (VK format) | Upgrade CLI a v15 primero, antes de cualquier build |
| `charms app deploy` no existe | El script `deploy-nft-contract.ts` implementa el ritual manual documentado |
| Genesis mint requiere wallet con tBTC | Checkpoint de participación humana en el plan |
| Contrato v15 puede tener breaking changes no detectados | `cargo test` + E2E en testnet4 antes de declarar done |
| raw TX vs PSBT del prover (bug histórico `80ad37e`) | El script maneja ambos formatos (`rawTxToPsbt`) |

---

## Referencias

- Contrato completo original: `git show 90cee8b:packages/bitcoin/contracts/genesis-babies/src/lib.rs`
- Spells TS vigentes: `packages/bitcoin/src/charms/nft.ts` (21 niveles, sin burn)
- Contratos de referencia (token, deployados): `packages/bitcoin/contracts/{babtc,babtc-v2}/src/lib.rs`
- Blueprint técnico: `docs/NFT_TECHNICAL_GUIDE.md`
- Charms v15 docs: https://docs.charms.dev/how-to/write-an-app-contract
- Prover live: https://v15.charms.dev/ready → `OK`
