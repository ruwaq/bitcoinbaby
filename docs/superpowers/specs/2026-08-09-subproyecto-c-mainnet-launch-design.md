# Sub-proyecto C — Mainnet + Launch (spec)

> **Fecha:** 2026-08-09
> **Roadmap:** A: ✅ mergeado (PR #3) · B: ✅ mergeado (PR #6, commit `662948e`) · **C: este**
> **Estado previo:** Sub-proyecto B implementó Fases 0-6 (hardening + Block-Tick). El gap crítico del C3 (cerrado on-chain, abierto off-chain) y la cuota del prover quedaron documentados en `SESSION-6-HANDOFF.md`. C los resuelve y lleva el producto a mainnet.
> **Decisión de scope del usuario:** "lo más profesional" → defensa en profundidad + cadena de suministro reproducible.

---

## 1. Contexto y problema

El producto BitcoinSparks consta hoy de: contrato NFT `genesis-babies` (Charms v15, ops `mint`/`work`/`work_proof`(deprecated)/`level_up`/`transfer`/`settle`), contrato token `babtc` v1 (PoW real) + `babtc-v2` (server-signed claims, verificación decorativa), worker Cloudflare, frontend Next.js, signer. Los sub-proyectos A y B deja explícitamente diferido a C:

1. **Cierre C3 off-chain** — el contrato cerró el exploit on-chain (op `work` deriva XP de PoW verificado), pero el worker en `apps/workers/src/routes/nft/evolve.ts:516-621` sigue emitiendo el op `work_proof` DEPRECATED que confía en `xp_gain` del witness. El nuevo op `work` tiene **0 callers en TS**. Hoy no es explotable porque `/work/:tokenId` está 503-gateada por `NFT_APP_ID` placeholder, pero se vuelve explotable al activar el app ID real.
2. **Cuota del prover** — `v15.charms.dev` (Succinct SP1) tiene 16.1875 PROVE, un genesis mint cuesta 16.3193 PROVE. Sin resolverlo, no hay genesis mint, no hay `NFT_APP_ID` real, todas las rutas NFT siguen en 503.
3. **Reconciliación BRO on-chain** — la fórmula canónica (`bro-reward.ts`: `1e8·clz²/2^halvings`) NO está alineada con el contrato v1 (`1e8·D²/100`, sin halving). Alinear requiere recompilar WASM → nuevo VK → orfana tokens testnet4.
4. **Riesgo supply-chain** — **3-4 VKs divergentes** circulando para el mismo contrato babtc v1: `acf2ec0b` en config, `ab70796e` en binario embebido en workers, `72cddbf0` en BUILD.md. El binario WASM embebido como string TS en `apps/workers/src/lib/babtc-v2-contract-binary.ts` **no se buildea desde source en CI**.
5. **`babtc-v2` decorativo** — `verify_server_signature` (líneas 163-191 de `babtc-v2/src/lib.rs`) solo valida longitud 64 + charset hex y retorna `true`. Producción está hardcodeada a este binario.

Cierre adicional fuera de scope A/B: mainnet deploy, auditoría externa, launch.

---

## 2. Enfoque arquitectónico — Big-Bang Reset

Para "lo más profesional" en un lanzamiento Bitcoin mainnet, se adopta **Big-Bang Reset**: reauditar contratos, builds y VKs; resetear testnet4 sin piedad; re-desplegar contratos con fórmulas alineadas y verificación criptográfica real; solo entonces activar mainnet. Una transición limpia.

**Razón de la elección sobre alternativas:**

| Alternativa                                           | Por qué no                                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Migración incremental** (preservar tokens testnet4) | Los 3-4 VKs divergentes y la lógica decorativa de v2 la hacen frágil. No hay mecanismo automático de migración de estado entre VKs. |
| **Mainnet paralela** (dejar testnet4 como está)       | Duplica trabajo, deja deuda técnica permanente, y producción requiere reauditar todo de todas formas.                               |

**Por qué el reset es aceptable:** los handoffs (SESSION-6:134, 152) declaran explícitamente "reset testnet4 aceptable". Los tokens en testnet4 son desechables por definición. No hay NFTs minteados on-chain (el `NFT_APP_ID` sigue siendo placeholder). Los tokens BABTC testnet4 no tienen valor real.

---

## 3. Las 5 fases (con dependencias explícitas)

```
Fase 0 — Limpieza + hardening de build          [CODEABLE HOY, sin bloqueos]
Fase 1 — Cierre C3 end-to-end                   [CODEABLE HOY, gate pre-deploy]
Fase 2 — Reconciliación BRO on-chain            [CODEABLE HOY]
   ──── BLOQUEO EXTERNO: cuota del prover ────
Fase 3 — Genesis mint real → NFT_APP_ID         [BLOQUEADO por cuota]
Fase 4 — E2E validación on-chain                [BLOQUEADO por Fase 3]
Fase 5 — Mainnet + launch + auditoría           [BLOQUEADO por Fase 4]
```

Fases 0, 1 y 2 son trabajo técnico limpio codeable en cualquier sesión sin pedir nada externo. Fase 3+ requiere decisión del operador (estrategia del prover). El spec las separa para que el trabajo no se trabe esperando inputs externos.

### Fase 0 — Limpieza + hardening de build

**Objetivo:** eliminar riesgo supply-chain y deuda técnica acumulada. Sin cambiar lógica de validación.

- **0.1 Fix 6 tests stale de `@bitcoinbaby/shared`.** Archivo `packages/shared/src/__tests__/phases.test.ts`. Causa: renombramiento de tabs del rediseño (`dashboard/nfts/wallet/more` → `home/explore/you`) no actualizó este test. Actualizar aserciones a la nueva nomenclatura.
- **0.2 Builds desde source en CI.** Reemplazar los **3 binarios WASM embebidos** como strings TS (`apps/workers/src/lib/babtc-contract-binary.ts` 118KB para babtc v1, `babtc-v2-contract-binary.ts` 334KB para v2, `nft-contract-binary.ts` 353KB para genesis-babies) por artifacts generados en CI desde `packages/bitcoin/contracts/{babtc,babtc-v2,genesis-babies}/src/lib.rs`. El CI compila con `cargo build --release --target wasm32-wasip1` + `charms app vk`, y publica el artifact (o lo inyecta en el worker en build time). El worker consume por VK, no un string hardcoded de 300KB. Esto cierra el riesgo supply-chain flaggeado en `docs/audits/AUDIT_REPORT_LATEST.md:134`.
- **0.3 Reconciliar y documentar los 3-4 VKs divergentes de babtc.** Investigar el origen de cada uno (`acf2ec0b` config, `ab70796e` binario workers, `72cddbf0` BUILD.md, `bad3cb4e` v2). Determinar cuál es canónico. Documentar en `docs/audits/VK_RECONCILIATION.md`. Como parte del reset de Fase 2, todos convergen a uno.
- **0.4 Fix `verify_server_signature` de babtc-v2.** Implementar validación criptográfica real (Schnorr BIP340 contra un `SERVER_PUBKEY` real cargado desde env/secret, no el placeholder `"DEPLOY_TIME_PUBKEY_HASH"` jamás leído). Mantener el modelo server-signed claims (no migrar a PoW directo) para preservar el flujo claim-minting existente. El `SERVER_PUBKEY_HASH` se carga en runtime desde `wrangler secret put`, nunca en el binario.

**Tests:** 6 tests de shared pasando; CI buildea WASM desde source y el VK coincide con el del worker; `verify_server_signature` rechaza firmas inválidas (test unit en cargo).

### Fase 1 — Cierre C3 end-to-end

**Objetivo:** que el op `work` hardenizado tenga callers reales en TS, no solo en el contrato. Gate obligatorio antes de activar `NFT_APP_ID`.

- **1.1 Crear `createNFTWorkSpell`** en `packages/bitcoin/src/charms/nft.ts`. Sigue el patrón de `createNFTWorkProofSpell` (`nft.ts:378`) pero construye un `WorkWitness { operation: "work", challenge, nonce, difficulty, current_block }` (sin `xp_gain` — el contrato lo deriva via `xp_from_difficulty`). Public inputs incluyen `challenge` y `difficulty`.
- **1.2 Crear `buildWorkSpellRequest`** en `apps/workers/src/services/nft-evolution-service.ts` (sigue el patrón de `buildWorkProofSpellRequest` en línea 84). Valida PoW llamando `validateMiningProof` (`apps/workers/src/lib/proof-validation.ts:61`) con el formato `challenge:nonce` (o adaptar `MiningProofInput { hash, nonce, difficulty, blockData }` al `WorkWitness`). Construye el witness `work` y llama `createNFTWorkSpell`.
- **1.3 Reemplazar en `evolve.ts:516-621`** la llamada a `buildWorkProofSpellRequest` por `buildWorkSpellRequest`. El body de la ruta cambia: en vez de aceptar `xpGain` del cliente, acepta `challenge` + `nonce` + `difficulty` y el server valida el PoW antes de construir el spell.
- **1.4 Extender `sparkNftStateSchema`** en `apps/workers/src/routes/nft/middleware.ts:135-150` con los 3 campos de settlement: `narrative_root`, `last_settle_block`, `settle_count` (con defaults para lazy migration, igual que el contrato `#[serde(default)]`).
- **1.5 Decidir op `work_proof` deprecated.** Post-migración de NFTs existentes (que en reset no hay), cambiar el match del contrato (`genesis-babies/src/lib.rs:194-202`) de aceptar `work_proof` a `_ => false`. Esto elimina definitivamente el vector C3. Durante la transición (si hubiera NFTs legacy), mantener aceptado pero documentar que el worker nunca debe emitirlo.

**Tests:** integration test que prueba que la ruta `/work/:tokenId` rechaza `xpGain` forjado y solo acepta PoW válido; unit test de `buildWorkSpellRequest`; el test `work_op_rejects_inflated_xp` ya existente (cargo) sigue pasando.

### Fase 2 — Reconciliación BRO on-chain

**Objetivo:** una sola fuente de verdad para la fórmula BRO. Sigue el checklist de `BRO_ALIGNMENT.md:67-75`.

- **2.1 Reescribir `babtc/src/lib.rs` `calculate_reward`** (líneas 180-195) para matchear `minedAmountBro`: cambiar `BASE_REWARD * d * d / DIFFICULTY_FACTOR` por `BRO_DENOMINATION * clz² / 2^halvings`. Agregar constantes `BRO_START_TIME` y `BRO_HALVING_PERIOD_SECONDS` (14 días) desde `bro-reward.ts`.
- **2.2 Recompilar WASM** → capturar nuevo VK. Este paso orfana tokens testnet4 existentes (aceptable por Big-Bang Reset).
- **2.3 Actualizar `scripts/signer/mint-babtc.ts`** para usar la fórmula canónica (no el `calculate_reward` legacy).
- **2.4 Marcar `calculateMiningReward` legacy de `token.ts`** como `@deprecated` definitivo (ya tiene la variante `calculateMiningRewardBro` canónica).

**Tests:** cargo test que verifica `calculate_reward` con `clz=16, período 0` da el mismo valor que `minedAmountBro(16, START_TIME)`; test de halving (período 1 da la mitad).

### [BLOQUEO EXTERNO — cuota del prover]

Fases 3+ requieren resolver la cuota del prover. **Esto NO es código** — es decisión del operador. Opciones documentadas en `SESSION-4-HANDOFF.md:25-34`:

- **(a) Comprar ≥16.32 PROVE credits** en Succinct Prover Network via `v15.charms.dev`. Latencia baja, cuesta dinero.
- **(b) Self-host SP1 prover:** `cargo install charms --locked --bin charms-prover --features prover` + `charms-prover server`. Gratis, ~minutos por proof (CPU). No dockerizado aún.
- **(c) No existe tercera opción** documentada.

Ver `DECISIÓN PENDIENTE` en sección 5.

### Fase 3 — Genesis mint real → NFT_APP_ID

**Objetivo:** deployar el contrato NFT on-chain y obtener el `NFT_APP_ID` real. Sigue `docs/NFT_DEPLOYMENT_RUNBOOK.md`.

- **3.1 Conseguir UTXO funding** confirmado (≥2000 sats) en dirección `tb1p...` (testnet4). 1 confirmación obligatoria.
- **3.2 Ejecutar `scripts/deploy-nft-contract.ts`** con la cuota del prover resuelta. Produce `commitTxHex` + `spellTxHex` raw unsigned.
- **3.3 Firma humana** (Taproot key-path, SIGHASH_DEFAULT) via `scripts/sign-and-broadcast.ts` o hardware wallet.
- **3.4 Broadcast en orden:** commit tx, esperar 1 confirmación, spell tx.
- **3.5 Capturar commit txid → confirmar app_id** (`SHA256("<fundingTxid>:<fundingVout>")`).
- **3.6 Escribir `NFT_APP_ID` real** en `apps/workers/wrangler.toml` (líneas 102, 162) + `packages/bitcoin/src/config/testnet4.ts`. Redeploy workers.

**Verificación:** `/health` ya no retorna 503; `/nft/mint`, `/nft/work`, `/nft/evolve` responden.

### Fase 4 — E2E validación on-chain

**Objetivo:** confirmar en cadena real (no solo tests) que el flujo completo funciona y C3 está cerrado.

- **4.1 Smoke test E2E en testnet4:** mint → work (op nuevo, no `work_proof`) → evolve → transfer. Con TXs confirmadas.
- **4.2 Verificar C3 cerrado en cadena real:** intentar forjar `xp_gain` debe ser rechazado por el contrato (el op `work` deriva, no acepta witness).
- **4.3 Actualizar scorecard honesto** en `docs/superpowers/notes/e2e-testnet4-validation.md` (nuevo, siguiendo el patrón de `e2e-regtest-validation.md`): qué se validó on-chain, qué no, qué bloqueos quedan.

### Fase 5 — Mainnet + launch + auditoría

**Objetivo:** producción. Sigue `docs/MAINNET_DEPLOYMENT.md` + Security Checklist (líneas 194-202).

- **5.1 Auditoría externa de seguridad.** Alcance recomendado: contratos (genesis-babies, babtc, babtc-v2) + worker routes (especialmente `/nft/*` y claim-minting) + signer. Requiere spec cerrado + Fase 4.
- **5.2 Generar treasury keys mainnet NUEVAS** (mnemonic nuevo, nunca reusar testnet). Hardware wallet. `generate-wallet.ts` ya escribe a archivo 0600 (Fase 5 de B).
- **5.3 Deploy contratos mainnet:** SPARK token (`babtc`) + Genesis Sparks NFT (`genesis-babies`). Repetir Fases 3-4 pero en mainnet (`bc1...` addresses).
- **5.4 Deploy workers prod** (`wrangler deploy --env production`). Secrets via `wrangler secret put`, nunca en wrangler.toml.
- **5.5 Deploy frontend Vercel** (env vars en dashboard).
- **5.6 Monitoring/alerting** activo antes de launch público.
- **5.7 [Opcional, post-launch web] Mobile stores** (App Store + Play Store).

---

## 4. Decisiones HEREDADAS (no se reabren)

| Tema                                                     | Decisión                                          | Origen        |
| -------------------------------------------------------- | ------------------------------------------------- | ------------- |
| Arquitectura Block-Tick + Batch Settlement               | Mantener                                          | Spec B        |
| `runAILoop` del orchestrator                             | Intacto (no reemplazar por block-observer)        | Spec B        |
| Fórmula BRO canónica = `bro-reward.ts`                   | `1e8·clz²/2^halvings`                             | Spec B Fase 3 |
| EZKL (Fase 7 de B)                                       | Deferred a sub-proyecto D (10-12 sesiones)        | Spec B        |
| Modelo claim-minting de v2                               | Mantener (con firma criptográfica real, Fase 0.4) | Este spec     |
| Commits neutrales `type(scope): desc` sin Co-Authored-By | Mantener                                          | CLAUDE.md     |
| Naming: Spark/$SPARK/Genesis Sparks/BitcoinSparks        | Mantener                                          | CLAUDE.md     |

---

## 5. Decisiones PENDIENTES (validar al revisar este spec)

Estas decisiones quedan escritas con recomendación pero **no se asumen** — el operador debe validarlas:

| #   | Decisión                                  | Recomendación                                                                                | Razón                                                                                                         |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| D1  | **Estrategia del prover** (Fase 3)        | Self-host SP1 en Docker para dev/testnet4 + credits Succinct para mainnet                    | Self-host es gratis pero ~min/proof (inaceptable para UX de mainnet); para dev/testnet la latencia no importa |
| D2  | **`work_proof` op deprecated** (Fase 1.5) | Desactivar (`_ => false` en match) inmediatamente tras reset (no hay NFTs legacy que migrar) | En Big-Bang Reset no hay estado que preservar; mantenerlo aceptado es deuda                                   |
| D3  | **EZKL / PoUW real**                      | Deferred a sub-proyecto D                                                                    | 10-12 sesiones; no hay PoUW-IA que cerrar (es hash de JSON); MVP sin EZKL defendible                          |
| D4  | **Mobile stores**                         | Post-launch web                                                                              | Primero validar mainnet web; mobile agrega release management                                                 |
| D5  | **Manager-NFT / supply cap avanzado**     | Post-launch                                                                                  | No bloqueante; se añade vía contract upgrade                                                                  |
| D6  | **Alcance auditoría externa**             | Contratos + worker routes + signer                                                           | Es lo que toca valor on-chain; frontend es menor                                                              |

---

## 6. Criterios de salida (definition of done)

### Gate técnico (Fases 0-2)

- [ ] 0 VKs divergentes — un binario por contrato, buildeado desde source en CI
- [ ] C3 cerrado end-to-end (op `work` con callers reales en TS)
- [ ] Fórmula BRO on-chain = off-chain = `bro-reward.ts`
- [ ] `babtc-v2` con `verify_server_signature` criptográfico real
- [ ] 6 tests de shared pasando
- [ ] CI verde (lint+typecheck+test+cargo+secret-scan+build)

### Gate on-chain (Fases 3-4)

- [ ] `NFT_APP_ID` real configurado (no placeholder)
- [ ] E2E testnet4 confirmado: mint → work → evolve → transfer con TXs confirmadas
- [ ] Scorecard honesto actualizado

### Gate launch (Fase 5)

- [ ] Auditoría externa sin críticos abiertos
- [ ] Treasury keys en hardware wallet, mnemonic nunca en repo/stdout
- [ ] Monitoring activo antes de launch público
- [ ] `MAINNET_DEPLOYMENT.md` Security Checklist (líneas 194-202) completo

---

## 7. Lo que este spec NO cubre (explícito)

- **EZKL / verificación probabilística de PoUW-IA** — sub-proyecto D futuro.
- **Modelo de IA de producción real** (hoy el "PoUW" es hash de JSON). Reemplazarlo por Transformers.js + modelo ONNX es sub-proyecto D.
- **Mobile stores submission** — post-launch web.
- **Migración de tokens testnet4 existentes** — en Big-Bang Reset no hay migración; el reset es aceptable.
- **Cambio de modelo claim-minting a PoW directo** — se mantiene v2 con firma arreglada (Fase 0.4), no se migra a v1.

---

## 8. Riesgos y mitigaciones

| Riesgo                                                 | Probabilidad | Impacto | Mitigación                                                                       |
| ------------------------------------------------------ | ------------ | ------- | -------------------------------------------------------------------------------- |
| Self-host SP1 prover demasiado lento para UX mainnet   | Media        | Medio   | Credits Succinct para mainnet (D1)                                               |
| `verify_server_signature` real rompe claims existentes | Baja         | Alto    | En reset no hay claims que preservar; test exhaustivo en cargo                   |
| Genesis mint falla por bug en script deploy            | Media        | Medio   | Dry-run en regtest primero (con workaround tb1p); Fase 4 valida antes de mainnet |
| Auditoría externa encuentra críticos                   | Media        | Alto    | Timebox antes de launch; no deployear mainnet con críticos abiertos              |
| Recompilación WASM rompe algo no anticipado            | Baja         | Medio   | CI buildea desde source (Fase 0.2) expone cualquier divergencia temprano         |
| `validateMiningProof` no encaja con `WorkWitness`      | Media        | Medio   | Fase 1.2 incluye paso de adaptación explícito                                    |

---

## 9. Orden de implementación sugerido para sesiones futuras

Cada fase es un candidate natural para una sesión de trabajo con su propio plan de implementación:

1. **Sesión 7:** Fase 0 + Fase 1 (limpieza + cierre C3 off-chain). Codeable, sin bloqueos. ~1 sesión.
2. **Sesión 8:** Fase 2 (reconciliación BRO on-chain) + preparación Docker del self-host prover. Codeable. ~1 sesión.
3. **[Pausa — operador resuelve cuota del prover (D1)]**
4. **Sesión 9:** Fases 3-4 (genesis mint + E2E testnet4). Requiere cuota. ~1-2 sesiones.
5. **[Pausa — auditoría externa]**
6. **Sesión 10+:** Fase 5 (mainnet + launch). Requiere auditoría limpia.
