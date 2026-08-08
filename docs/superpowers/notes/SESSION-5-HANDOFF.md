# Handoff — Sesión 5 → Sesión 6

> **Fecha:** 2026-08-08
> **Branch actual:** `docs/subproyecto-b-spec` (sin commitear aún el spec corregido + este handoff)
> **Main:** `e4e60ff` (al día con origin)
> **Estado:** Sub-proyecto B (Hardening + Block-Tick Mining) **diseñado y documentado**, listo para implementar. El spec se corrigió tras explorar el código real.

---

## Dónde estamos

```
A. Testnet4 profesional NFT  ✅ HECHO (mergeado PR #3, main e4e60ff)
B. Hardening + Block-Tick    ⏳ SPEC ESCRITO (este handoff), pendiente implementar
C. Mainnet + launch          ⏳ Pendiente
```

La sesión 5 hizo **3 cosas**:
1. **Limpieza de repo** (sync main, recuperar handoff huérfano, borrar branch feat, PR #4 merged).
2. **Investigación profunda** (3 reportes en paralelo: ecosistema Charms, modelos económicos, modelos ecológicos) → convergió en arquitectura "Block-Tick + Batch Settlement".
3. **Exploración del código real** (4 agentes leyeron cada `.ts`/`.tsx`/`.rs`) → reveló que el spec inicial se basaba en docs mentirosos; se añadió addéndum al spec con la verdad.

---

## ⚠️ Lo más importante que descubrimos (la verdad del código)

El spec del sub-proyecto B vive en:
**`docs/superpowers/specs/2026-08-08-hardening-block-tick-mining-design.md`**

Lee primero el **ADDÉNDUM (Sección A1-A4)** al final de ese spec — ahí está la diferencia entre lo que los docs dicen y lo que el código hace. Resumen brutal:

### Funciona de verdad
- Wallet HD (BIP39/86, Taproot, PSBT, zeroing de keys).
- Game engine completo (decay, 11 achievements, XP, evolutions, game loop).
- 15 stores Zustand reales, consumidos por el frontend.
- Frontend completo (mint, marketplace, wallet send, claim) cableado a APIs reales.
- Charms prover integration (CBOR real, retry, spells V9/V10/V11).
- Contrato NFT v15 (26 tests, estricto en transiciones de estado).
- Contrato token v1 (`babtc`) — **PoW on-chain REAL** (recomputa double-SHA256 como BRO).

### Es fachada/muerto/incompleto
- **Mineros muertos**: `cpu-miner.ts` + `webgpu-miner.ts` (1600 líneas, correctos pero **0 instanciaciones**).
- **"PoUW" no verificable**: `ai-integration.ts` solo hashea JSON; `baby-brain.ts` es template-filling; **no hay Transformers.js**.
- **PoW clásico DESCONECTADO**: `validateMiningProof` y `processMiningCredit` son código huérfano sin caller.
- **Contrato `babtc-v2` = CÁSCARA**: `verify_server_signature` retorna `true` tras validar solo longitud+charset.
- **NFT on-chain BLOQUEADO**: `NFT_APP_ID` placeholder → rutas 503.
- **Signer del tesoro NO EXISTE**: `treasury-signer.ts` dice "Does NOT do actual signing".
- **Código muerto**: `prover-client.ts`, configs duplicadas, dos sistemas baby/spark paralelos.

---

## La buena noticia: C3 se cierra reutilizando código existente

El código para cerrar C3 **ya está escrito** en dos lugares:

| Código | Dónde | Reutilización |
|---|---|---|
| `verify_pow` + `count_leading_zeros` + `double_sha256` | `babtc/src/lib.rs:202-228` | Portar a `genesis-babies` para `validate_settle` |
| `validateMiningProof` + `countLeadingZeroBits` | `apps/workers/src/lib/proof-validation.ts:61-161` | Cablear a `/work/:tokenId` |
| `processMiningCredit` | `apps/workers/src/services/mining-credit.ts` | Revivir como caller del path PoW |
| Ruta vieja `/work-proof` | `apps/workers/src/routes/nft/evolve.ts:248-361` | YA valida PoW real — fuente de inspiración |

**No hay que escribir criptografía nueva. Hay que conectar lo que existe.**

---

## La arquitectura decidida: Block-Tick + Batch Settlement

Resumen (detalles en el spec, Secciones 1-5):

```
CAPA INSTANTÁNEA (off-chain, accesible a TODOS)
  • 0 TX Bitcoin por click, 0 hashing del jugador
  • Block hash de Bitcoin (cada ~10 min) = 1 "tick" → aleatoriedad TRUSTLESS
  • XP en Merkle tree en el cliente + receipts firmados (semi-trustless)
          │
          │ Batch periódico (diario/semanal)
          ▼
CAPA DE SETTLEMENT (on-chain, Charms v15)
  • 1 spell `settle` commitea narrativeRoot + XP derivada de ticks
  • xp_gain ya NO es input del witness (se deriva on-chain)
  • Fórmula BRO exacta: 1e8·clz²/2^halvings
  • Costo: ~$0.05-0.10/jugador/día (vs $20-40 de BRO)
```

**Cumple todos los requisitos del usuario:**
- C3/trustless ✅ (Merkle root verificada, xp_gain derivado no witness libre)
- Económico ✅ (99% menos que BRO)
- Ecológico ✅ (cero hashing del jugador, reusa block hash)
- Accesible universal ✅ (cliente ligero, sin ASIC, navegador/móvil)
- Fórmula BRO exacta ✅ (`1e8·clz²/2^halvings`)
- EZKL probabilístico ✅ (5% sampling + slashing — pero es **opcional/fase final**, ver abajo)

---

## Orden de implementación (próxima sesión)

### Fase 0 — Limpieza (antes de añadir nada)
1. Aislar mineros muertos en `packages/core/src/mining/legacy/`.
2. Decidir `babtc-v2` (recomendado: archivar/eliminar — es cáscara).
3. Eliminar `prover-client.ts` muerto o revivirlo.
4. Reconciliar configs duplicadas (`deployment.ts` vs `testnet4.ts`).
5. `git rm --cached .claude/memory.md` + añadir a `.gitignore`.
6. Quitar `getMinerType()` mentiroso del orchestrator.

### Fase 1 — Cerrar C3 (reutilizando código)
7. Portar `verify_pow` de `babtc/src/lib.rs` → nueva op `settle` en `genesis-babies/src/lib.rs`.
8. Cablear `validateMiningProof` en la ruta `/work/:tokenId` (hoy no la invoca).
9. Revivir `processMiningCredit` como caller del path PoW.
10. Tests Rust + E2E regtest del `settle`.

### Fase 2 — Batch settlement
11. Implementar `createSettleSpell` en `packages/bitcoin/src/charms/nft.ts` (F7 de AI_WORLD_ENGINE).
12. Añadir campos `narrative_root`, `last_settle_block`, `settle_count` al contrato NFT.
13. Worker orquesta batch (1 spell/día/jugador).

### Fase 3 — Fórmula BRO
14. Implementar `mined_amount_bro` en contrato wasm.
15. Alinear `mint-babtc.ts`, `babtc/src/lib.rs` a la misma fórmula.

### Fase 4 — Block-Tick cliente
16. Reemplazar loop IA del orchestrator por block observer.
17. NUEVO `packages/core/src/mining/block-observer.ts`.

### Fase 5 — Signer hardening
18. `generate-wallet.ts` no imprime mnemonic a stdout.

### Fase 6 — CI/CD
19. Crear `.github/workflows/ci.yml` (hoy no existe).

### Fase 7 — EZKL (OPCIONAL, fase final)
20. Construir PoUW desde cero (no hay Transformers.js hoy). Puede ir en sub-proyecto B.5 o C si el MVP ya es suficiente.

---

## Bloqueos que siguen (no resueltos esta sesión)

1. **Cuota del prover** — el genesis mint on-chain real sigue bloqueado por `ResourceExhausted` en v15.charms.dev. La lógica del contrato se valida con cargo test + mock prover. Opciones: comprar credits Succinct, self-host SP1, o usar testnet4.

2. **EZKL es más trabajo del estimado** — no hay PoUW-IA que "mejorar", hay que construirlo desde cero. Por eso se movió a fase opcional.

---

## Comandos rápidos

```bash
# Estado del repo
git status                                          # limpio (main e4e60ff)
git branch                                          # solo main + docs/subproyecto-b-spec

# Verificar todo verde
pnpm typecheck
pnpm --filter @bitcoinbaby/workers test
pnpm --filter @bitcoinbaby/core test
pnpm --filter @bitcoinbaby/bitcoin test
cd packages/bitcoin/contracts/genesis-babies && cargo test  # 26

# Stack regtest (corriendo ya)
docker compose up -d
curl http://localhost:3000/getnewaddress

# Validar contrato sin prover
pnpm tsx scripts/validate-nft-contract.ts

# Leer el spec del sub-proyecto B (EMPEZAR AQUÍ)
cat docs/superpowers/specs/2026-08-08-hardening-block-tick-mining-design.md
```

---

## Documentos clave para no perder contexto

- **`docs/superpowers/specs/2026-08-08-hardening-block-tick-mining-design.md`** — el spec del sub-proyecto B (lee el ADDÉNDUM al final)
- `docs/superpowers/notes/SESSION-4-HANDOFF.md` — handoff anterior (contexto del sub-proyecto A)
- `docs/superpowers/notes/charms-v15-witness-spike.md` — cómo funciona Charms v15 (autoritativo)
- `docs/superpowers/notes/e2e-regtest-validation.md` — qué se validó E2E
- `docs/AI_WORLD_ENGINE.md` — diseño 2 capas (referencia para batch)
- `docs/TECHNICAL_DECISIONS.md` puntos 9-10 — EZKL probabilístico
- `docs/audits/SECURITY_AUDIT_2026-03-08.md` — auditoría previa (14 críticos)
- `.claude/memory.md` — memoria del proyecto (local, sale del tracking en Fase 0)

---

## Lo que NO hay que tocar (funciona y está verificado)

- Contrato NFT v15 (`genesis-babies/src/lib.rs`) — solo EXTENDER con `settle`, no romper.
- Wallet, game engine, stores, frontend — funcionan.
- Contrato `babtc` v1 (PoW on-chain real) — funciona, fuente de `verify_pow` a portar.
- Stack Docker regtest — funciona.
