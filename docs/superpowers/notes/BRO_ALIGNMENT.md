# BRO Reward Formula Alignment (Sub-proyecto B, Fase 3)

Date: 2026-08-08. Branch: `feat/subproyecto-b-hardening-block-tick`.

## TL;DR

There used to be **four** inconsistent reward formulas in this repo. Fase 3
introduces **one** canonical off-chain formula (`minedAmountBro`) and makes the
two conflicting off-chain libs delegate to it. The on-chain v1 contract and the
signer are **intentionally NOT touched** — doing so would orphan already-minted
testnet4 tokens. That realignment is deferred to sub-proyecto C (mainnet).

## The four formulas that existed

| #   | Location                                                                               | Formula                                                   | D16, period 0      |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------ |
| A   | `scripts/signer/mint-babtc.ts`                                                         | `2^(D-16) * 1000`                                         | 1,000              |
| B   | `packages/bitcoin/contracts/babtc/src/lib.rs` (on-chain v1)                            | `BASE_REWARD * D² / DIFFICULTY_FACTOR` (`1e8·D²/100`)     | 256,000,000        |
| C   | `packages/bitcoin/src/charms/token.ts` `calculateMiningReward(clz)`                    | `(baseReward * clz²) / difficultyFactor` (`1e8·clz²/100`) | 256,000,000        |
| D   | `packages/bitcoin/src/blockchain/merkle.ts` `calculateMiningReward(clz, t, start, hp)` | `DENOMINATION · clz² / 2^halvings`                        | **25,600,000,000** |

**D is the BRO canonical** (`1e8 · clz² / 2^halvings`, halving every 14 days
from genesis). B and C agree with each other (/100, no halving) but diverge
from D by **100×** and omit halving. A is unrelated (exponential). Two
functions were both named `calculateMiningReward` (C in token.ts, D in
merkle.ts), which confused consumers.

## What Fase 3 changed (this commit)

- **Added** `packages/bitcoin/src/charms/bro-reward.ts` — the single source of
  truth: `minedAmountBro(clz, blockTime, halvingPeriodSeconds?, startTime?)`,
  plus `BRO_DENOMINATION`, `BRO_START_TIME` (2025-09-02 16:20:00 UTC =
  `1_756_830_000`), `BRO_HALVING_PERIOD_SECONDS` (14 days). Includes overflow
  safety (caps halvings at 63) and clamps `blockTime >= startTime`.
- **`merkle.ts`** `calculateMiningReward` now **delegates** to `minedAmountBro`,
  passing through its `startTime` / `halvingPeriodSeconds` params. Behavior
  unchanged (`merkle.test.ts` still passes; D16@period0 = 25,600,000,000n).
- **`token.ts`** keeps the **legacy** `calculateMiningReward` exactly as-is
  (v1-contract-locked, /100, no halving) and is now marked `@deprecated` with a
  full explanation. A **new canonical** `calculateMiningRewardBro(clz,
blockTime?)` (and `MiningRewardBro` type) delegates to `minedAmountBro` and
  applies the same 90/5/5 split. New off-chain code (estimation, analytics, UI
  projections) should use the canonical one.
- **Tests:** `tests/charms/bro-reward.test.ts` pins the canonical formula,
  the merkle delegation (incl. custom `startTime`), and the token canonical
  variant. `merkle.test.ts` and `token.test.ts` (legacy) both still pass.
- **Barrels:** `minedAmountBro`, `calculateMiningRewardBro`, `BRO_*`
  constants, and `MiningRewardBro` are re-exported from `charms/index.ts` and
  the package root.

## What is NOT changed (and why) — sub-proyecto C

- **`packages/bitcoin/contracts/babtc/src/lib.rs` (v1 on-chain contract).**
  Changing the contract formula recompiles the WASM circuit → new `appVk` →
  every proof minted under the old VK becomes unverifiable, orphaning
  already-minted testnet4 tokens. Realignment requires a contract
  redeployment + state migration, which is only acceptable at mainnet.
- **`scripts/signer/mint-babtc.ts`.** The signer is locked to the v1
  contract's `calculate_reward`; changing the signer's reward alone makes its
  mint spells fail v1 validation. It must change **in lockstep** with the
  contract.
- **`packages/bitcoin/contracts/babtc-v2/`.** Left in place per the Fase 0
  decision; production claim-mint is hardcoded to it.
- **`apps/workers/src/services/batch-minting.ts`.** Uses a third VK via
  transfer spells; out of scope.

## VK migration checklist (for sub-proyecto C)

1. Rewrite `babtc/src/lib.rs` `calculate_reward` to match `minedAmountBro`
   (drop `/100`, add 14-day halving from `START_TIME`).
2. Recompile WASM → capture new `appVk`.
3. Migrate / rebase existing testnet4 token state to the new VK, or reset.
4. Update `scripts/signer/mint-babtc.ts` and the token.ts legacy
   `calculateMiningReward` (then retire the legacy function).
5. Re-point production claim-mint and the batch-minting worker at the new VK.

## Verification

- `pnpm --filter @bitcoinbaby/bitcoin test` → 557 passed (19 files), incl.
  the 16 new `bro-reward.test.ts` cases.
- `pnpm --filter @bitcoinbaby/bitcoin typecheck` → clean.
