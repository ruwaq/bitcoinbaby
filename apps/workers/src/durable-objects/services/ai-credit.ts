/**
 * AI Credit Service
 *
 * Handles AI Proof of Useful Work (PoUW) verification, Schnorr signature checking,
 * Sybil protection, reward calculations, and random LLM-as-a-Judge audits.
 */

import * as secp from "@noble/secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import { balanceLogger } from "../../lib/logger";
import type { AIProof, VirtualBalance, Env } from "../../lib/types";
import { getNetworkForEnvironment } from "../../config/bitcoin";
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
import {
  BASE_REWARD_PER_SHARE,
  STREAK_RESET_MS,
} from "../../lib/proof-validation";
import { getStreakMultiplier } from "../../lib/proof-validation";
import type { BalanceRepository } from "../repositories/balance-repository";

export interface AICreditResult {
  success: boolean;
  error?: string;
  errorCode?: number;
  proofId?: string;
  reward?: bigint;
  balance?: VirtualBalance;
  boosts?: AIBoostInfo;
}

export interface AIBoostInfo {
  streak: {
    consecutiveShares: number;
    multiplier: number;
    baseReward: string;
    boostedReward: string;
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
  reputation: {
    multiplier: number;
    score: number;
  };
  totalMultiplier: number;
}

export interface AICreditDeps {
  env: Env;
  address: string;
  balance: VirtualBalance;
  submissionsInLastHour: number;
  balanceRepo: BalanceRepository;
}

/**
 * Process an AI PoUW submission, calculate rewards, and trigger random audit
 */
export async function processAICredit(
  proof: AIProof,
  deps: AICreditDeps,
): Promise<AICreditResult> {
  const { env, address, balance } = deps;
  const now = Date.now();

  // 1. Verify lockout period
  if (balance.lockoutUntil && now < balance.lockoutUntil) {
    const remainingMin = Math.ceil((balance.lockoutUntil - now) / 60000);
    return {
      success: false,
      error: `Cuenta temporalmente suspendida debido a fallas de consenso/auditoría. Intenta de nuevo en ${remainingMin} minutos.`,
      errorCode: 423,
    };
  }

  // 2. Cryptographic Validation: Verify Schnorr signature (BIP340)
  try {
    const pubkeyBuffer = Buffer.from(proof.publicKey, "hex");
    // Schnorr requires x-only 32-byte public key
    const xOnlyPubkey =
      pubkeyBuffer.length === 32 ? pubkeyBuffer : pubkeyBuffer.slice(1);

    // Calculate message hash: SHA256(taskId + ":" + output)
    const encoder = new TextEncoder();
    const msgBytes = encoder.encode(`${proof.taskId}:${proof.output}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBytes);
    const messageHash = new Uint8Array(hashBuffer);

    const signatureBytes = Uint8Array.from(Buffer.from(proof.signature, "hex"));

    const isValidSig = await secp.schnorr.verify(
      signatureBytes,
      messageHash,
      xOnlyPubkey,
    );

    if (!isValidSig) {
      balanceLogger.warn("AI Proof Schnorr signature verification failed", {
        address,
        taskId: proof.taskId,
      });
      return {
        success: false,
        error: "Firma digital Schnorr no válida.",
        errorCode: 401,
      };
    }
  } catch (error) {
    balanceLogger.error("Error verifying AI Proof Schnorr signature", {
      error,
      address,
    });
    return {
      success: false,
      error: "Error al verificar la firma de la prueba.",
      errorCode: 400,
    };
  }

  // 3. Verify Derived Bitcoin Address Matches Client Address (Prevention of Spoofing)
  let derivedAddress: string | undefined;
  const pubkeyBuffer = Buffer.from(proof.publicKey, "hex");
  const xOnlyPubkey =
    pubkeyBuffer.length === 32 ? pubkeyBuffer : pubkeyBuffer.slice(1);

  const bitcoinNetworkName = getNetworkForEnvironment(env.ENVIRONMENT);
  const bitcoinNetwork =
    bitcoinNetworkName === "mainnet"
      ? bitcoin.networks.bitcoin
      : bitcoinNetworkName === "regtest"
        ? bitcoin.networks.regtest
        : bitcoin.networks.testnet;

  // Try to derive address from different standard templates
  try {
    const p2tr = bitcoin.payments.p2tr({
      pubkey: xOnlyPubkey,
      network: bitcoinNetwork,
    });
    if (p2tr.address === address) {
      derivedAddress = p2tr.address;
    }
  } catch {
    /* ignore */
  }

  if (!derivedAddress) {
    try {
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: pubkeyBuffer,
        network: bitcoinNetwork,
      });
      if (p2wpkh.address === address) {
        derivedAddress = p2wpkh.address;
      }
    } catch {
      /* ignore */
    }
  }

  if (!derivedAddress) {
    try {
      const p2pkh = bitcoin.payments.p2pkh({
        pubkey: pubkeyBuffer,
        network: bitcoinNetwork,
      });
      if (p2pkh.address === address) {
        derivedAddress = p2pkh.address;
      }
    } catch {
      /* ignore */
    }
  }

  if (!derivedAddress || derivedAddress !== address) {
    balanceLogger.warn("Address derivation mismatch", {
      address,
      derived: derivedAddress || "failed",
    });
    return {
      success: false,
      error: "La clave pública provista no corresponde a tu dirección de Bitcoin.",
      errorCode: 403,
    };
  }

  // 4. Sybil Protection
  const redis = getRedis(env);
  const nftData = await getNFTBoostData(redis, address);
  const hasNFT = nftData.nftCount > 0;
  const hasPriorBalance = balance.totalMined > 0n || balance.virtualBalance > 0n;

  if (!hasNFT && !hasPriorBalance) {
    return {
      success: false,
      error: "Sybil Protection: Debes poseer al menos un Genesis Baby NFT o balance previo para minar.",
      errorCode: 403,
    };
  }

  // 5. Calculate Rewards
  // AI Proofs reward consists of a base reward (same as classic) plus a token-count utility bonus
  const baseReward = BASE_REWARD_PER_SHARE;

  // Compute utility bonus based on tokens generated (~words in output)
  const tokenWords = proof.output.split(/\s+/).filter(Boolean).length;
  // Limit max tokens bonus to prevent gaming (max 100 words/tokens bonus)
  const clampedWords = Math.min(tokenWords, 100);
  // Each word grants 1% extra utility reward
  const tokenBonus = BigInt(clampedWords) * (baseReward / 100n);
  const totalBaseReward = baseReward + tokenBonus;

  // Streak Multiplier
  const streakActive = now - balance.lastMiningAt < STREAK_RESET_MS;
  const consecutiveShares = streakActive ? balance.streakCount : 0;
  const streakMultiplier = getStreakMultiplier(consecutiveShares);

  // NFT Boost
  let nftMultiplier = 1.0;
  let nftBoostPercent = 0;
  let userBabyType = "human";

  if (MULTIPLIER_CONFIG.enabled.nft) {
    nftBoostPercent = nftData.totalBoostPercent;
    nftMultiplier = getNFTMultiplier(nftBoostPercent);
    userBabyType = nftData.bestNFTBaseType;
  }

  // Engagement Boost
  let engagementMultiplier = 1.0;
  let engagementBoostPercent = 0;

  if (MULTIPLIER_CONFIG.enabled.engagement) {
    try {
      const engagementData = await getEngagementBoostData(redis, address);
      engagementBoostPercent = engagementData.totalBoostPercent;
      engagementMultiplier = getEngagementMultiplier(engagementBoostPercent);
    } catch (error) {
      balanceLogger.warn("Engagement boost fetch failed in AI Credit", { error });
    }
  }

  // Cosmic Boost
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
      balanceLogger.warn("Cosmic boost calc failed in AI Credit", { error });
    }
  }

  // Reputation Multiplier (Bonus for high reputation, penalization for low reputation)
  const currentRep = balance.reputationScore ?? 100;
  let reputationMultiplier = 1.0;
  if (currentRep >= 90) {
    reputationMultiplier = 1.1; // +10% bonus for good behavior
  } else if (currentRep < 50) {
    reputationMultiplier = 0.5; // -50% penalty for suspicious behavior
  }

  // Combine multipliers
  const combinedMultiplier = Math.min(
    streakMultiplier *
      nftMultiplier *
      engagementMultiplier *
      cosmicMultiplier *
      reputationMultiplier,
    MULTIPLIER_CONFIG.maxTotalMultiplier,
  );

  const boostedReward = BigInt(
    Math.floor(Number(totalBaseReward) * combinedMultiplier),
  );

  // 6. Update user balance in Durable Object
  const newStreakCount = streakActive ? balance.streakCount + 1 : 1;
  const updatedBalance: VirtualBalance = {
    ...balance,
    virtualBalance: balance.virtualBalance + boostedReward,
    totalMined: balance.totalMined + boostedReward,
    lastMiningAt: now,
    streakCount: newStreakCount,
    updatedAt: now,
  };

  const boosts: AIBoostInfo = {
    streak: {
      consecutiveShares: newStreakCount,
      multiplier: streakMultiplier,
      baseReward: totalBaseReward.toString(),
      boostedReward: boostedReward.toString(),
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
    reputation: {
      multiplier: reputationMultiplier,
      score: currentRep,
    },
    totalMultiplier: combinedMultiplier,
  };

  balanceLogger.info("AI credit successfully processed", {
    address,
    reward: boostedReward.toString(),
    reputation: currentRep,
    wordsMined: tokenWords,
  });

  return {
    success: true,
    proofId: crypto.randomUUID(),
    reward: boostedReward,
    balance: updatedBalance,
    boosts,
  };
}

/**
 * Perform background semantic audit using Workers AI
 */
export async function performSemanticAudit(
  env: Env,
  proof: AIProof,
  address: string,
  reward: bigint,
  balanceRepo: BalanceRepository,
): Promise<void> {
  try {
    balanceLogger.info("Performing random semantic audit...", {
      address,
      taskId: proof.taskId,
    });

    const systemPrompt = `Eres un juez de Inteligencia Artificial que audita tareas de Proof of Useful Work para BitcoinBaby.
Analiza si el siguiente prompt y la respuesta generada por el usuario son semánticamente coherentes, lógicos y no constituyen texto basura, spam repetitivo, o respuestas completamente vacías o genéricas que no responden a la instrucción.
Responde únicamente con una estructura JSON: {"valid": true} si la respuesta es correcta y útil, o {"valid": false} si la respuesta es spam, incoherente, vacía, repetitiva o un intento de engañar al sistema. No agregues texto adicional.`;

    const userPrompt = `Prompt de la Tarea: "${proof.inputPrompt}"
Semilla de Contexto: "${proof.seed}"
Respuesta Generada por el Usuario: "${proof.output}"`;

    let isValid = true;

    if (!env.AI) {
      balanceLogger.info("Workers AI not available, passing audit by default");
    } else {
      // Execute Cloudflare Workers AI
      const result = (await env.AI.run("@cf/meta/llama-3-8b-instruct", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      })) as { response?: string; response_format?: unknown } | unknown;

      // Type-safe checking of Workers AI response structure
      if (result && typeof result === "object") {
        const resObj = result as Record<string, unknown>;
        const responseText = (resObj.response || "") as string;

        if (responseText) {
          try {
            const parsed = JSON.parse(responseText) as Record<string, unknown>;
            if (parsed && typeof parsed === "object" && "valid" in parsed) {
              isValid = parsed.valid === true;
            }
          } catch {
            // Fallback parsing: look for boolean or strings
            const lowerText = responseText.toLowerCase();
            if (lowerText.includes("false")) {
              isValid = false;
            }
          }
        } else {
          // Fallback: check raw JSON dump
          const rawJson = JSON.stringify(result).toLowerCase();
          if (rawJson.includes('"valid":false') || rawJson.includes('"valid": false')) {
            isValid = false;
          }
        }
      }
    }

    // Load fresh state to update
    const currentBalance = balanceRepo.getOrCreate(address);

    if (isValid) {
      const currentRep = currentBalance.reputationScore ?? 100;
      currentBalance.reputationScore = Math.min(currentRep + 1, 100);
      balanceRepo.update(currentBalance);
      balanceLogger.info(
        "Semantic audit PASSED. User reputation updated.",
        { address, reputation: currentBalance.reputationScore },
      );
    } else {
      balanceLogger.warn(
        "Semantic audit FAILED. Fraud or spam detected. Executing Slashing!",
        { address, taskId: proof.taskId, output: proof.output },
      );

      // Deduct reward
      const newVirtual =
        currentBalance.virtualBalance > reward
          ? currentBalance.virtualBalance - reward
          : 0n;
      const newMined =
        currentBalance.totalMined > reward
          ? currentBalance.totalMined - reward
          : 0n;

      currentBalance.virtualBalance = newVirtual;
      currentBalance.totalMined = newMined;
      currentBalance.reputationScore = 0; // Reputation drops to zero
      currentBalance.lockoutUntil = Date.now() + 3600000; // 1-hour lockout

      balanceRepo.update(currentBalance);

      balanceLogger.error("Slashing penalty successfully recorded", {
        address,
        lockoutUntil: new Date(currentBalance.lockoutUntil).toISOString(),
      });
    }
  } catch (error) {
    balanceLogger.error("Failed executing background semantic audit", {
      error,
      address,
    });
  }
}
