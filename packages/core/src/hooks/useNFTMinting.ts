/**
 * useNFTMinting Hook
 *
 * Manages Genesis Sparks NFT operations on Bitcoin via Charms protocol.
 * Handles genesis minting, work proofs (XP), and level ups.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  createCharmsClient,
  TransactionBuilder,
  createMempoolClient,
  Psbt,
  type CharmsClientOptions,
  type SparkNFTState,
  type Bloodline,
  type BaseType,
  type RarityTier,
  createNFTGenesisSpell,
  createNFTWorkProofSpell,
  createNFTLevelUpSpell,
  GENESIS_SPARKS_CONFIG,
  getMiningBoost,
  canLevelUp,
  XP_REQUIREMENTS,
} from "@bitcoinbaby/bitcoin";

// =============================================================================
// TYPES
// =============================================================================

export interface UseNFTMintingOptions extends CharmsClientOptions {
  /** Owner's Bitcoin address */
  ownerAddress: string;
  /** Owner's public key (hex) for Taproot signing */
  ownerPublicKey: string;
  /** NFT App ID from Charms deployment */
  nftAppId: string;
  /** NFT App VK (verification key) */
  nftAppVk: string;
  /** Token App ID (for level up burns) */
  tokenAppId?: string;
  /** Token App VK */
  tokenAppVk?: string;
}

export interface NFTMintResult {
  success: boolean;
  psbt?: string;
  nftState?: SparkNFTState;
  error?: string;
}

export interface UseNFTMintingReturn {
  /** Mint a new Genesis Spark NFT */
  mintGenesis: (params: {
    tokenId: number;
    dna: string;
    bloodline: Bloodline;
    baseType: BaseType;
    rarityTier: RarityTier;
    heritage: number;
  }) => Promise<NFTMintResult>;

  /** Submit work proof for XP gain */
  submitWorkProof: (
    nft: SparkNFTState,
    nftUtxo: { txid: string; vout: number },
    workProofHash: string,
  ) => Promise<NFTMintResult>;

  /** Level up an NFT (burns tokens) */
  levelUp: (
    nft: SparkNFTState,
    nftUtxo: { txid: string; vout: number },
    tokenUtxo: { txid: string; vout: number },
    tokenAmount: bigint,
  ) => Promise<NFTMintResult>;

  /** Sign and broadcast a pending PSBT */
  signAndBroadcast: (
    psbtBase64: string,
    privateKey: Uint8Array,
  ) => Promise<{ success: boolean; txid?: string; error?: string }>;

  /** Check if NFT can level up */
  checkCanLevelUp: (nft: SparkNFTState) => {
    canLevel: boolean;
    xpRequired: number;
    currentXp: number;
  };

  /** Get mining boost for an NFT */
  getBoost: (nft: SparkNFTState) => number;

  /** Generate random DNA for new NFT */
  generateDNA: () => Promise<string>;

  /** Determine rarity tier based on roll */
  rollRarity: () => RarityTier;

  /** Operation in progress */
  isProcessing: boolean;

  /** Last error */
  error: string | null;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate random DNA (64 hex chars)
 */
async function generateRandomDNA(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Roll for rarity tier based on weights
 */
function rollRarityTier(): RarityTier {
  const tiers = GENESIS_SPARKS_CONFIG.rarityTiers;
  const totalWeight = Object.values(tiers).reduce(
    (sum, t) => sum + t.weight,
    0,
  );
  const roll = Math.random() * totalWeight;

  let cumulative = 0;
  for (const [tier, config] of Object.entries(tiers)) {
    cumulative += config.weight;
    if (roll < cumulative) {
      return tier as RarityTier;
    }
  }

  return "common"; // Fallback
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useNFTMinting(
  options: UseNFTMintingOptions,
): UseNFTMintingReturn {
  const {
    network = "testnet4",
    ownerAddress,
    ownerPublicKey,
    nftAppId,
    nftAppVk,
    tokenAppId,
    tokenAppVk,
  } = options;

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NFT store

  // Clients
  const charmsRef = useRef<ReturnType<typeof createCharmsClient> | null>(null);
  const mempoolRef = useRef<ReturnType<typeof createMempoolClient> | null>(
    null,
  );
  const txBuilderRef = useRef<TransactionBuilder | null>(null);

  // Initialize clients
  useEffect(() => {
    const btcNetwork = network === "main" ? "mainnet" : "testnet4";
    charmsRef.current = createCharmsClient({ network });
    mempoolRef.current = createMempoolClient({ network: btcNetwork });
    txBuilderRef.current = new TransactionBuilder({ network: btcNetwork });
  }, [network]);

  // Mint genesis NFT
  const mintGenesis = useCallback(
    async (params: {
      tokenId: number;
      dna: string;
      bloodline: Bloodline;
      baseType: BaseType;
      rarityTier: RarityTier;
      heritage: number;
    }): Promise<NFTMintResult> => {
      if (!charmsRef.current || !mempoolRef.current || !txBuilderRef.current) {
        return { success: false, error: "Clients not initialized" };
      }

      setIsProcessing(true);
      setError(null);

      try {
        // Get current block height
        const blockHeight = await charmsRef.current.getBlockHeight();

        // Create spell
        const spell = createNFTGenesisSpell({
          appId: nftAppId,
          appVk: nftAppVk,
          ownerAddress,
          tokenId: params.tokenId,
          dna: params.dna,
          bloodline: params.bloodline,
          baseType: params.baseType,
          rarityTier: params.rarityTier,
          genesisBlock: blockHeight,
          heritage: params.heritage,
        });

        // Get UTXOs for transaction
        const utxos = await mempoolRef.current.getUTXOs(ownerAddress);
        if (utxos.length === 0) {
          throw new Error("No UTXOs available");
        }

        // Build transaction
        const pubKeyBytes = Buffer.from(ownerPublicKey, "hex");
        const xOnlyPubKey = new Uint8Array(pubKeyBytes.subarray(1, 33));

        const btcNetwork = network === "main" ? "mainnet" : "testnet4";
        const txUtxos = TransactionBuilder.convertUTXOs(
          utxos.filter((u) => u.value >= 5000),
          ownerAddress,
          btcNetwork,
          xOnlyPubKey,
        );

        // Get fee info
        const [feeEstimates, scrollsFee] = await Promise.all([
          mempoolRef.current.getFeeEstimates(),
          charmsRef.current.calculateScrollsFee(1, utxos[0].value),
        ]);

        txBuilderRef.current.setFeeRate(feeEstimates.halfHourFee);

        // Build spell transaction
        const feeAddress = await charmsRef.current.getFeeAddress();
        const tx = txBuilderRef.current.buildMiningTx(
          txUtxos,
          ownerAddress,
          spell,
          feeAddress,
          scrollsFee,
        );

        // Build PSBT
        const psbt = txBuilderRef.current.buildPSBT(tx, tx.spellWitness);

        // Create NFT state for return
        const nftState: SparkNFTState = {
          dna: params.dna,
          bloodline: params.bloodline,
          baseType: params.baseType,
          genesisBlock: blockHeight,
          rarityTier: params.rarityTier,
          tokenId: params.tokenId,
          heritage: params.heritage,
          level: 1,
          xp: 0,
          totalXp: 0,
          workCount: 0,
          lastWorkBlock: blockHeight,
          evolutionCount: 0,
          tokensEarned: 0n,
          narrativeRoot: "",
          worldStateRoot: "",
          lastSettleBlock: 0,
          settleCount: 0,
        };

        return {
          success: true,
          psbt: psbt.toBase64(),
          nftState,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsProcessing(false);
      }
    },
    [ownerAddress, ownerPublicKey, nftAppId, nftAppVk, network],
  );

  // Submit work proof
  const submitWorkProof = useCallback(
    async (
      nft: SparkNFTState,
      nftUtxo: { txid: string; vout: number },
      workProofHash: string,
    ): Promise<NFTMintResult> => {
      if (!charmsRef.current || !mempoolRef.current || !txBuilderRef.current) {
        return { success: false, error: "Clients not initialized" };
      }

      setIsProcessing(true);
      setError(null);

      try {
        const blockHeight = await charmsRef.current.getBlockHeight();

        const spell = createNFTWorkProofSpell({
          appId: nftAppId,
          appVk: nftAppVk,
          nftUtxo,
          currentState: nft,
          ownerAddress,
          workProofHash,
          currentBlock: blockHeight,
        });

        // Get UTXOs
        const utxos = await mempoolRef.current.getUTXOs(ownerAddress);
        if (utxos.length === 0) {
          throw new Error("No UTXOs available");
        }

        // Build transaction (similar to mintGenesis)
        const pubKeyBytes = Buffer.from(ownerPublicKey, "hex");
        const xOnlyPubKey = new Uint8Array(pubKeyBytes.subarray(1, 33));
        const btcNetwork = network === "main" ? "mainnet" : "testnet4";

        const txUtxos = TransactionBuilder.convertUTXOs(
          utxos.filter((u) => u.value >= 5000),
          ownerAddress,
          btcNetwork,
          xOnlyPubKey,
        );

        const [feeEstimates, scrollsFee] = await Promise.all([
          mempoolRef.current.getFeeEstimates(),
          charmsRef.current.calculateScrollsFee(2, utxos[0].value), // 2 inputs
        ]);

        txBuilderRef.current.setFeeRate(feeEstimates.halfHourFee);

        const feeAddress = await charmsRef.current.getFeeAddress();
        const tx = txBuilderRef.current.buildMiningTx(
          txUtxos,
          ownerAddress,
          spell,
          feeAddress,
          scrollsFee,
        );

        const psbt = txBuilderRef.current.buildPSBT(tx, tx.spellWitness);

        return {
          success: true,
          psbt: psbt.toBase64(),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsProcessing(false);
      }
    },
    [ownerAddress, ownerPublicKey, nftAppId, nftAppVk, network],
  );

  // Level up
  const levelUp = useCallback(
    async (
      nft: SparkNFTState,
      nftUtxo: { txid: string; vout: number },
      _tokenUtxo: { txid: string; vout: number },
      _tokenAmount: bigint,
    ): Promise<NFTMintResult> => {
      if (!charmsRef.current || !mempoolRef.current || !txBuilderRef.current) {
        return { success: false, error: "Clients not initialized" };
      }

      if (!tokenAppId || !tokenAppVk) {
        return { success: false, error: "Token app not configured" };
      }

      if (!canLevelUp(nft)) {
        return {
          success: false,
          error: `Not enough XP. Need ${XP_REQUIREMENTS[nft.level + 1]}`,
        };
      }

      setIsProcessing(true);
      setError(null);

      try {
        const spell = createNFTLevelUpSpell({
          nftAppId,
          nftAppVk,
          tokenAppId,
          tokenAppVk,
          nftUtxo,
          currentState: nft,
          ownerAddress,
        });

        // Get UTXOs
        const utxos = await mempoolRef.current.getUTXOs(ownerAddress);
        if (utxos.length === 0) {
          throw new Error("No UTXOs available");
        }

        // Build transaction
        const pubKeyBytes = Buffer.from(ownerPublicKey, "hex");
        const xOnlyPubKey = new Uint8Array(pubKeyBytes.subarray(1, 33));
        const btcNetwork = network === "main" ? "mainnet" : "testnet4";

        const txUtxos = TransactionBuilder.convertUTXOs(
          utxos.filter((u) => u.value >= 5000),
          ownerAddress,
          btcNetwork,
          xOnlyPubKey,
        );

        const [feeEstimates, scrollsFee] = await Promise.all([
          mempoolRef.current.getFeeEstimates(),
          charmsRef.current.calculateScrollsFee(3, utxos[0].value), // 3 inputs
        ]);

        txBuilderRef.current.setFeeRate(feeEstimates.halfHourFee);

        const feeAddress = await charmsRef.current.getFeeAddress();
        const tx = txBuilderRef.current.buildMiningTx(
          txUtxos,
          ownerAddress,
          spell,
          feeAddress,
          scrollsFee,
        );

        const psbt = txBuilderRef.current.buildPSBT(tx, tx.spellWitness);

        return {
          success: true,
          psbt: psbt.toBase64(),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsProcessing(false);
      }
    },
    [
      ownerAddress,
      ownerPublicKey,
      nftAppId,
      nftAppVk,
      tokenAppId,
      tokenAppVk,
      network,
    ],
  );

  // Sign and broadcast
  const signAndBroadcast = useCallback(
    async (
      psbtBase64: string,
      privateKey: Uint8Array,
    ): Promise<{ success: boolean; txid?: string; error?: string }> => {
      if (!txBuilderRef.current || !mempoolRef.current) {
        return { success: false, error: "Clients not initialized" };
      }

      setIsProcessing(true);

      try {
        const psbt = Psbt.fromBase64(psbtBase64);

        txBuilderRef.current.signPSBT(psbt, privateKey);
        const signedTx = txBuilderRef.current.finalizePSBT(psbt);

        const txid = await mempoolRef.current.broadcastTransaction(
          signedTx.hex,
        );

        return { success: true, txid };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  // Check can level up
  const checkCanLevelUp = useCallback((nft: SparkNFTState) => {
    const nextLevel = nft.level + 1;
    const xpRequired = XP_REQUIREMENTS[nextLevel] || Infinity;

    return {
      canLevel: canLevelUp(nft),
      xpRequired,
      currentXp: nft.xp,
    };
  }, []);

  // Get boost
  const getBoost = useCallback((nft: SparkNFTState) => {
    return getMiningBoost(nft);
  }, []);

  // Generate DNA
  const generateDNA = useCallback(async () => {
    return generateRandomDNA();
  }, []);

  // Roll rarity
  const rollRarity = useCallback(() => {
    return rollRarityTier();
  }, []);

  return {
    mintGenesis,
    submitWorkProof,
    levelUp,
    signAndBroadcast,
    checkCanLevelUp,
    getBoost,
    generateDNA,
    rollRarity,
    isProcessing,
    error,
  };
}

export default useNFTMinting;
