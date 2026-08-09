/**
 * Canonical BRO reward formula — single source of truth.
 *
 * Formula: mined_amount_bro(block_time, clz) = DENOMINATION · clz² / 2^halvings
 *   where halvings = floor((block_time - START_TIME) / HALVING_PERIOD_SECONDS)
 *
 * Reference: BRO token (github.com/CharmsDev/bro), IACR block-hash beacon.
 * This is the ONLY reward formula bitcoinbaby should use. All other reward
 * computations (token.ts, merkle.ts, and eventually the on-chain babtc contract
 * + signer) must delegate to or match this.
 *
 * Why halving: BRO halves rewards every 14 days from genesis (START_TIME) to
 * create a decaying emission schedule, mirroring Bitcoin's own halving logic.
 *
 * Status of alignment (2026-08-09, sub-proyecto C Fase 2):
 *   - DONE This module (canonical reference).
 *   - DONE token.ts calculateMiningReward — kept as the LEGACY v1 formula,
 *        now formally @deprecated (sub-proyecto C Fase 2.4); canonical
 *        variant exposed via calculateMiningRewardBro in token.ts.
 *   - DONE merkle.ts calculateMiningReward — delegates here (Step 2).
 *   - DONE babtc/src/lib.rs (v1 on-chain contract) — calculate_reward now uses
 *        `BRO_DENOMINATION · clz² / 2^halvings` with halving + START_TIME
 *        (sub-proyecto C Fase 2.1). VK rotated; testnet4 tokens orphaned by
 *        design (Big-Bang Reset). The contract's MiningWitness now carries
 *        `block_time` for the halving schedule.
 *   - DONE scripts/signer/mint-babtc.ts — calculateReward delegates to
 *        minedAmountBro and emits `block_time` in the witness (sub-proyecto C
 *        Fase 2.2).
 *   - FOLLOW-UP: submitter.ts display-only calls to the legacy
 *        calculateMiningReward (lines ~581, ~688) remain for UI display of the
 *        v1 flow; they do NOT feed the witness or on-chain spell. Migrate them
 *        to calculateMiningRewardBro when the v1 display path is retired.
 */

/** 8 decimals (1 whole token = 1e8 base units), matches BRO denomination. */
export const BRO_DENOMINATION = 100_000_000n;

/**
 * BRO genesis time (2025-09-02 UTC, epoch seconds).
 * This is the anchor for the halving schedule: rewards before this default to
 * START_TIME (no negative halvings). See BRO_ALIGNMENT.md for rationale.
 */
export const BRO_START_TIME = 1_756_830_000;

/** BRO halves every 14 days (in seconds). */
export const BRO_HALVING_PERIOD_SECONDS = 14 * 24 * 60 * 60;

/**
 * Maximum halving periods considered. Beyond 63 the divisor 2^64 exceeds any
 * realistic 64-bit reward numerator, so we cap to avoid overflow. At one
 * halving per ~14 days this is ~2.4 years of headroom from genesis; if/when
 * needed, raise this cap alongside a u256 migration.
 */
const MAX_HALVING_PERIODS = 63;

/**
 * Canonical BRO mined amount.
 *
 * @param clz - leading zero BITS of the proof-of-work hash (or observed Bitcoin
 *              block hash in the Block-Tick model). Negative values clamp to 0.
 * @param blockTime - unix seconds of the block being rewarded. Clamped to
 *                    `startTime` if earlier (no negative halvings).
 * @param halvingPeriodSeconds - override (default 14 days). Rarely changed.
 * @param startTime - override genesis anchor (default BRO_START_TIME). Kept as
 *                    an optional parameter so legacy callers (e.g.
 *                    merkle.ts's calculateMiningReward) that pass a custom
 *                    start time can delegate without changing semantics. New
 *                    code should omit this to use the canonical BRO_START_TIME.
 * @returns base-unit reward (bigint). Saturates on overflow (never throws).
 */
export function minedAmountBro(
  clz: number,
  blockTime: number,
  halvingPeriodSeconds: number = BRO_HALVING_PERIOD_SECONDS,
  startTime: number = BRO_START_TIME,
): bigint {
  const safeClz = BigInt(Math.max(0, clz));
  const safeTime = Math.max(blockTime, startTime);
  const periodsPassed = Math.floor(
    (safeTime - startTime) / halvingPeriodSeconds,
  );
  // Cap periods to avoid 2^n overflow; 64 halvings -> divisor = 2^64 > any reward.
  const safePeriods = Math.max(0, Math.min(periodsPassed, MAX_HALVING_PERIODS));
  const halvingFactor = 2n ** BigInt(safePeriods);
  const clzSquared = safeClz * safeClz;
  return (BRO_DENOMINATION * clzSquared) / halvingFactor;
}
