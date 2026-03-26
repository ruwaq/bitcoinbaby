/**
 * Mining Credit Service
 *
 * Orchestrates proof validation, boost calculations, and reward crediting.
 * Extracted from VirtualBalanceDO for better modularity.
 */

import { balanceLogger } from "../../lib/logger";
import type { MiningProof, VirtualBalance, Env } from "../../lib/types";
import {
  validateMiningProof,
  checkRateLimit,
  getStreakMultiplier,
  isProofUsedGlobally,
  markProofUsedGlobally,
  STREAK_RESET_MS,
  MIN_DIFFICULTY,
} from "../../lib/proof-validation";
import { processShare, type UserDifficultyState } from "../../lib/vardiff";
import { getRedis } from "../../lib/redis";
import { getNFTBoostData, getNFTMultiplier } from "../../lib/nft-boost";
import {
  getEngagementBoostData,
  getEngagementMultiplier,
} from "../../lib/engagement-boost";
import {
  getCosmicBoostData,
  getCosmicMultiplier,
} from "../../lib/cosmic-boost";
import { MULTIPLIER_CONFIG } from "../../lib/reward-multipliers";

export interface CreditResult {
  success: boolean;
  error?: string;
  errorCode?: number;
  proofId?: string;
  reward?: bigint;
  balance?: VirtualBalance;
  boosts?: BoostInfo;
  varDiff?: VarDiffInfo;
}

export interface BoostInfo {
  streak: {
    consecutiveShares: number;
    multiplier: number;
    baseReward: string;
    boostedReward: string;
    nextTierAt: number;
  };
  nft: {
    multiplier: number;
    boostPercent: number;
    enabled: boolean;
  };
  engagement: {
    multiplier: number;
    boostPercent: number;
    enabled: boolean;
  };
  cosmic: {
    multiplier: number;
    boostPercent: number;
    status: string;
    enabled: boolean;
  };
  totalMultiplier: number;
}

export interface VarDiffInfo {
  suggestedDifficulty: number;
  averageShareTime: number;
  difficultyChanged: boolean;
}

export interface MiningCreditDeps {
  env: Env;
  address: string;
  balance: VirtualBalance;
  difficultyState: UserDifficultyState;
  sharesInLastHour: number;
}

const STREAK_TIERS = [10, 50, 100, 250, 500];

function getNextStreakTier(currentShares: number): number {
  for (const tier of STREAK_TIERS) {
    if (currentShares < tier) return tier;
  }
  return 500;
}

/**
 * Process a mining proof and calculate rewards with all boosts
 */
export async function processMiningCredit(
  proof: MiningProof,
  deps: MiningCreditDeps,
): Promise<CreditResult> {
  const { env, address, balance } = deps;
  let { difficultyState } = deps;
  const now = Date.now();

  // Coerce nonce to number
  const nonce =
    typeof proof.nonce === "string"
      ? parseInt(proof.nonce, 10)
      : typeof proof.nonce === "number"
        ? proof.nonce
        : NaN;

  if (isNaN(nonce)) {
    return {
      success: false,
      error: `Invalid proof: nonce must be a number (got ${typeof proof.nonce})`,
      errorCode: 400,
    };
  }

  const proofWithNonce = { ...proof, nonce };

  // 1. Validate proof cryptographically
  const proofValidation = await validateMiningProof({
    hash: proofWithNonce.hash,
    nonce: proofWithNonce.nonce,
    difficulty: proofWithNonce.difficulty,
    blockData: proofWithNonce.blockData,
    timestamp: proofWithNonce.timestamp,
  });

  if (!proofValidation.valid) {
    balanceLogger.warn("Proof validation failed", {
      address,
      reason: proofValidation.reason,
      hash: proofWithNonce.hash.slice(0, 16),
    });
    return {
      success: false,
      error: `Invalid proof: ${proofValidation.reason}`,
      errorCode: 400,
    };
  }

  // 2. Check global duplicate
  const kv = env.CACHE || null;
  const globalCheck = await isProofUsedGlobally(
    proofWithNonce.hash,
    kv,
    env.ENVIRONMENT,
  );

  if (globalCheck.error) {
    return { success: false, error: globalCheck.error, errorCode: 503 };
  }

  if (globalCheck.used) {
    balanceLogger.info("Duplicate proof rejected", {
      address,
      hash: proofWithNonce.hash.slice(0, 16),
    });
    return { success: false, error: "Proof already used", errorCode: 409 };
  }

  // 3. Rate limiting
  const rateLimitCheck = checkRateLimit({
    sharesThisHour: deps.sharesInLastHour,
    lastShareTime: balance.lastMiningAt,
  });

  if (!rateLimitCheck.valid) {
    return { success: false, error: rateLimitCheck.reason!, errorCode: 429 };
  }

  // 4. VarDiff validation
  if (proofWithNonce.difficulty < MIN_DIFFICULTY) {
    return {
      success: false,
      error: `Share difficulty D${proofWithNonce.difficulty} below minimum D${MIN_DIFFICULTY}`,
      errorCode: 400,
    };
  }

  // Process VarDiff
  const varDiffResult = processShare(difficultyState, now);
  difficultyState = varDiffResult.state;

  // 5. Calculate boosts
  const streakActive = now - balance.lastMiningAt < STREAK_RESET_MS;
  const consecutiveShares = streakActive ? balance.streakCount : 0;
  const streakMultiplier = getStreakMultiplier(consecutiveShares);

  // NFT boost
  let nftMultiplier = 1.0;
  let nftBoostPercent = 0;
  let userBabyType = "human";

  if (MULTIPLIER_CONFIG.enabled.nft) {
    try {
      const redis = getRedis(env);
      const nftData = await getNFTBoostData(redis, address);
      nftBoostPercent = nftData.totalBoostPercent;
      nftMultiplier = getNFTMultiplier(nftBoostPercent);
      userBabyType = nftData.bestNFTBaseType;
    } catch (error) {
      balanceLogger.warn("NFT boost fetch failed", { error });
    }
  }

  // Engagement boost
  let engagementMultiplier = 1.0;
  let engagementBoostPercent = 0;

  if (MULTIPLIER_CONFIG.enabled.engagement) {
    try {
      const redis = getRedis(env);
      const engagementData = await getEngagementBoostData(redis, address);
      engagementBoostPercent = engagementData.totalBoostPercent;
      engagementMultiplier = getEngagementMultiplier(engagementBoostPercent);
    } catch (error) {
      balanceLogger.warn("Engagement boost fetch failed", { error });
    }
  }

  // Cosmic boost
  let cosmicMultiplier = 1.0;
  let cosmicBoostPercent = 0;
  let cosmicStatus = "normal";

  if (MULTIPLIER_CONFIG.enabled.cosmic) {
    try {
      const cosmicData = getCosmicBoostData(userBabyType);
      cosmicBoostPercent = cosmicData.totalBoostPercent;
      cosmicMultiplier = getCosmicMultiplier(cosmicBoostPercent);
      cosmicStatus = cosmicData.status;
    } catch (error) {
      balanceLogger.warn("Cosmic boost calc failed", { error });
    }
  }

  // 6. Calculate final reward
  const baseReward = proofValidation.calculatedReward!;
  const combinedMultiplier = Math.min(
    streakMultiplier * nftMultiplier * engagementMultiplier * cosmicMultiplier,
    MULTIPLIER_CONFIG.maxTotalMultiplier,
  );
  const boostedReward = BigInt(
    Math.floor(Number(baseReward) * combinedMultiplier),
  );

  // 7. Mark proof globally (MUST succeed before crediting)
  const markSuccess = await markProofGloballyWithRetry(
    proofWithNonce.hash,
    address,
    kv,
  );

  if (!markSuccess) {
    return {
      success: false,
      error: "Unable to process proof. Please retry in a moment.",
      errorCode: 503,
    };
  }

  // 8. Update balance
  const proofId = crypto.randomUUID();
  const newStreakCount = streakActive ? balance.streakCount + 1 : 1;

  const updatedBalance: VirtualBalance = {
    ...balance,
    virtualBalance: balance.virtualBalance + boostedReward,
    totalMined: balance.totalMined + boostedReward,
    lastMiningAt: now,
    streakCount: newStreakCount,
    updatedAt: now,
  };

  // 9. Build response
  const boosts: BoostInfo = {
    streak: {
      consecutiveShares: newStreakCount,
      multiplier: streakMultiplier,
      baseReward: baseReward.toString(),
      boostedReward: boostedReward.toString(),
      nextTierAt: getNextStreakTier(newStreakCount),
    },
    nft: {
      multiplier: nftMultiplier,
      boostPercent: nftBoostPercent,
      enabled: MULTIPLIER_CONFIG.enabled.nft,
    },
    engagement: {
      multiplier: engagementMultiplier,
      boostPercent: engagementBoostPercent,
      enabled: MULTIPLIER_CONFIG.enabled.engagement,
    },
    cosmic: {
      multiplier: cosmicMultiplier,
      boostPercent: cosmicBoostPercent,
      status: cosmicStatus,
      enabled: MULTIPLIER_CONFIG.enabled.cosmic,
    },
    totalMultiplier: combinedMultiplier,
  };

  const varDiff: VarDiffInfo = {
    suggestedDifficulty: difficultyState.currentDiff,
    averageShareTime: varDiffResult.result.averageShareTime,
    difficultyChanged: varDiffResult.result.changed,
  };

  balanceLogger.info("Credit calculated", {
    address,
    reward: boostedReward.toString(),
    difficulty: proofWithNonce.difficulty,
    totalMultiplier: combinedMultiplier.toFixed(3),
  });

  return {
    success: true,
    proofId,
    reward: boostedReward,
    balance: updatedBalance,
    boosts,
    varDiff,
  };
}

/**
 * Mark proof globally with retry logic
 */
async function markProofGloballyWithRetry(
  hash: string,
  address: string,
  kv: KVNamespace | null,
  retries = 3,
): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await markProofUsedGlobally(hash, address, kv);
      return true;
    } catch (e) {
      balanceLogger.warn("KV mark attempt failed", {
        attempt,
        retries,
        error: e instanceof Error ? e.message : String(e),
      });
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 50 * Math.pow(2, attempt - 1)));
      }
    }
  }
  return false;
}
