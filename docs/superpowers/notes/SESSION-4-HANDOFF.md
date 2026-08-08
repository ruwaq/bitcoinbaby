# Handoff — Sesión 4 → Sesión 5

> **Fecha:** 2026-08-08
> **Branch:** `feat/testnet4-profesional-nft` (ya mergeado a main)
> **PR:** https://github.com/ruwaq/bitcoinbaby/pull/3 (**MERGED** el 2026-08-08, merge commit `e6ec8a4`)
> **Estado:** Sub-proyecto A (Testnet4 profesional NFT) completado, validado y **mergeado a main**.

> [Sesión 5] Nota: este doc quedó huérfano en el branch feat tras el merge. Se recuperó y llevó a main el 2026-08-08 (sesión 5). El estado del PR arriba fue actualizado a MERGED; el resto del doc refleja el estado al cierre de la sesión 4.

---

## Dónde estamos

El **Sub-proyecto A** (de 3) está completo: el contrato NFT está reescrito en Charms v15, endurecido tras un review de seguridad, validado (26 cargo tests + spell check verde), y el stack Docker regtest funciona. El PR #3 está abierto y mergeable.

**El roadmap completo** (definido en la sesión 4):
- **A. Testnet4 profesional** ✅ HECHO (este PR)
- **B. Hardening de seguridad** ⏳ pendiente
- **C. Mainnet + launch** ⏳ pendiente

---

## ⚠️ Los 2 bloqueos reales (lo que falta para tener NFTs on-chain)

### Bloqueo 1: Genesis mint on-chain requiere cuota del prover

El contrato y los spells están validados, pero producir el genesis mint **on-chain** (que crea el primer NFT y establece el app ID) requiere un prover real. Descubrimos:

- `MOCK=1 charms server` **NO es un prover local** — es un proxy que reenvía a `https://v15.charms.dev`.
- `v15.charms.dev` devuelve `ResourceExhausted: insufficient balance 16.18 PROVE for request cost 16.32 PROVE`.
- **Soluciones** (cualquiera desbloquea):
  1. **Comprar ≥16.32 PROVE credits** en v15.charms.dev (vía Succinct Prover Network).
  2. **Self-hosted SP1 prover**: `cargo install charms --locked --bin charms-prover --features prover` + `charms-prover server`. Lento (CPU, minutos por proof) pero gratis.
  3. **Usar testnet4** en vez de regtest (el prover hosted acepta testnet4, no regtest). Igual necesita la cuota.

**Cuando se resuelva**, ejecutar: `tsx scripts/deploy-nft-contract.ts` (script ya escrito y documentado en `docs/NFT_DEPLOYMENT_RUNBOOK.md`).

### Bloqueo 2: C3 — no on-chain PoW verification

El contrato confía en `xp_gain` del witness sin verificar que se hizo trabajo real (PoW/PoUW). Un atacante con acceso directo al prover podría forjar XP. Esto NO bloquea testnet4 pero **sí es obligatorio para mainnet**. Va en el sub-proyecto B.

---

## ✅ Lo que está hecho y verificado (no tocar salvo bug)

| Componente | Archivo | Estado |
|---|---|---|
| Contrato NFT v15 | `packages/bitcoin/contracts/genesis-babies/src/lib.rs` | ✅ 26 tests, compila a wasm |
| VK v15 | `0d9483a760ef91eef606e84fbff326132b3e611bc913025913bc34b6655b08ba` | ✅ Embebido en worker |
| Witness plumbing | `app_private_inputs` (top-level del request) | ✅ Documentado en spike |
| Servicio evolución | `apps/workers/src/services/nft-evolution-service.ts` | ✅ work_proof + level_up |
| Rutas evolución | `POST /api/nft/work/:tokenId`, `/evolve/:tokenId` | ✅ Ownership + guard |
| Deploy script | `scripts/deploy-nft-contract.ts` | ✅ Runbook en `docs/NFT_DEPLOYMENT_RUNBOOK.md` |
| Stack regtest | `docker compose up -d` | ✅ API en :3000, faucet funciona |
| Validación contrato | `scripts/validate-nft-contract.ts` | ✅ `pnpm tsx` para correr |

---

## Comandos rápidos para la próxima sesión

```bash
# Verificar todo verde
pnpm typecheck                                    # 7/7
pnpm --filter @bitcoinbaby/workers test           # 141
pnpm --filter @bitcoinbaby/core test              # 445
pnpm --filter @bitcoinbaby/bitcoin test           # 541
cd packages/bitcoin/contracts/genesis-babies && cargo test  # 26

# Stack regtest local
docker compose up -d
curl http://localhost:3000/getnewaddress          # bcrt1...
curl -X POST http://localhost:3000/faucet -H "Content-Type: application/json" -d '{"address":"<addr>","amount":0.01}'

# Validar contrato sin Bitcoin/prover
pnpm tsx scripts/validate-nft-contract.ts

# Genesis mint (CUANDO haya cuota de prover)
tsx scripts/deploy-nft-contract.ts --funding-txid <txid> --funding-vout <vout> --funding-value <sats> --owner-address <addr>

# Ver el PR
gh pr view 3
gh pr merge 3 --squash  # cuando se decida mergear
```

---

## Próximos pasos recomendados (orden de prioridad)

1. **Decidir qué hacer con el PR #3** — mergear a main, o dejar abierto mientras se resuelve el bloqueo del prover.
2. **Resolver el bloqueo del prover** — la opción más práctica para seguir probando es el **self-hosted SP1 prover** (gratis, CPU lento pero suficiente para genesis mint). La opción más rápida de adoptar es **comprar credits** en Succinct.
3. **Ejecutar el genesis mint** una vez resuelto el prover → capturar app ID real → configurar `wrangler.toml` → redeploy workers.
4. **Sub-proyecto B (hardening)**: abordar C3 (on-chain PoW), auditoría completa del signer/API, reactivar CI/CD. Spec pendiente de escribir.
5. **Sub-proyecto C (mainnet)**: deploy contratos a mainnet, security audit externa, deploy Vercel final, mobile stores.

---

## Documentos clave para no perder contexto

- `docs/superpowers/specs/2026-08-08-testnet4-profesional-nft-design.md` — el diseño completo
- `docs/superpowers/plans/2026-08-08-testnet4-profesional-nft.md` — el plan de 17 tareas
- `docs/superpowers/notes/charms-v15-witness-spike.md` — **autoritativo** sobre cómo funciona Charms v15
- `docs/superpowers/notes/e2e-regtest-validation.md` — scorecard honesto de qué se validó
- `docs/NFT_DEPLOYMENT_RUNBOOK.md` — procedimiento de genesis mint
- `.claude/memory.md` — memoria del proyecto (local, gitignored)
