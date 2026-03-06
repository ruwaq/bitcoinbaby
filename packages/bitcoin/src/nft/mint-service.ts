/**
 * NFT Mint Service
 *
 * @deprecated This service uses OP_RETURN for spell data which is limited to 80 bytes.
 * NFT spells exceed this limit. Use `useNFTMinting` from `@bitcoinbaby/core` instead,
 * which uses witness data (like inscriptions) for the spell.
 *
 * Complete service for minting Genesis Babies NFTs.
 * Handles PSBT creation, spell encoding, and transaction building.
 *
 * Flow:
 * 1. Generate NFT traits (deterministic from DNA)
 * 2. Create mint spell
 * 3. Build PSBT with payment outputs
 * 4. Return PSBT for wallet signing
 */

import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { sha256 } from "../crypto";
import { bytesToHex, hexToBytes } from "../crypto";
import type { UTXO } from "../blockchain/types";
import type { BitcoinNetwork } from "../types";
import {
  GENESIS_BABIES_CONFIG,
  type BabyNFTState,
  type Bloodline,
  type BaseType,
  type RarityTier,
  getTraitsFromDNA,
  createNFTGenesisSpell,
} from "../charms/nft";
import type { SpellV2 } from "../charms/types";
import {
  NFT_SALE_CONFIG,
  getTreasuryAddress,
  calculateNFTPrice,
} from "../charms/nft-sale";
import { GENESIS_BABIES_TESTNET4 } from "../config/testnet4";
import { encodeSpellForWitness } from "../transactions/spell-encoder";
import {
  validateMintRequest,
  checkRateLimit,
  recordMintAttempt,
} from "./validation";
import { stringifyWithBigInt } from "../utils";

// Initialize ECC
bitcoin.initEccLib(ecc);

// =============================================================================
// TYPES
// =============================================================================

export interface MintServiceOptions {
  network: BitcoinNetwork;
}

export interface MintRequest {
  /** Buyer's address */
  buyerAddress: string;
  /** Buyer's public key (hex, required for P2TR signing) */
  buyerPublicKey?: string;
  /** Buyer's UTXOs for payment */
  utxos: UTXO[];
  /** Optional: specific DNA (otherwise random) */
  dna?: string;
  /** Fee rate in sat/vB */
  feeRate?: number;
}

export interface MintResult {
  success: boolean;
  /** PSBT hex for signing */
  psbtHex?: string;
  /** PSBT base64 for wallet compatibility */
  psbtBase64?: string;
  /** Generated NFT state */
  nft?: BabyNFTState;
  /** Token ID assigned */
  tokenId?: number;
  /** Total cost in sats */
  totalCost?: bigint;
  /** Error message */
  error?: string;
}

export interface PreviewResult {
  nft: BabyNFTState;
  dna: string;
  traits: ReturnType<typeof getTraitsFromDNA>;
}

// =============================================================================
// NETWORK CONFIG
// =============================================================================

const NETWORKS: Record<BitcoinNetwork, bitcoin.Network> = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  testnet4: bitcoin.networks.testnet,
  regtest: bitcoin.networks.regtest,
};

// =============================================================================
// MINT SERVICE
// =============================================================================

export class NFTMintService {
  private network: bitcoin.Network;
  private networkName: BitcoinNetwork;
  private mintedCount: number = 0;

  constructor(options: MintServiceOptions) {
    this.networkName = options.network;
    this.network = NETWORKS[options.network];
  }

  /**
   * Set the current minted count (for token ID assignment)
   */
  setMintedCount(count: number): void {
    this.mintedCount = count;
  }

  /**
   * Generate a preview NFT (no transaction)
   */
  preview(dna?: string): PreviewResult {
    const finalDna = dna || this.generateDNA();
    const traits = getTraitsFromDNA(finalDna);
    const nft = this.createNFTState(finalDna, this.mintedCount + 1);

    return { nft, dna: finalDna, traits };
  }

  /**
   * Create mint PSBT
   */
  async createMintPSBT(request: MintRequest): Promise<MintResult> {
    try {
      // Get treasury address
      const treasury = getTreasuryAddress();

      // Security: Rate limiting
      const rateLimitResult = checkRateLimit(request.buyerAddress);
      if (!rateLimitResult.valid) {
        return { success: false, error: rateLimitResult.error };
      }

      // Security: Comprehensive input validation
      const validationResult = validateMintRequest({
        buyerAddress: request.buyerAddress,
        utxos: request.utxos,
        treasuryAddress: treasury,
        network: this.networkName,
        dna: request.dna,
      });

      if (!validationResult.valid) {
        return { success: false, error: validationResult.error };
      }

      // Log warnings if any (but continue)
      if (validationResult.warnings) {
        console.warn("Mint validation warnings:", validationResult.warnings);
      }

      // Calculate totals
      const price = calculateNFTPrice();
      const totalInput = request.utxos.reduce(
        (sum, u) => sum + BigInt(u.value),
        0n,
      );

      // Estimate fee
      const feeRate = request.feeRate || 10;
      const estimatedVsize = 150 + request.utxos.length * 68 + 3 * 43; // inputs + outputs
      const fee = BigInt(estimatedVsize * feeRate);

      const totalCost = price.priceSats + NFT_SALE_CONFIG.dustLimit + fee;

      if (totalInput < totalCost) {
        return {
          success: false,
          error: `Insufficient funds. Need ${totalCost} sats, have ${totalInput} sats`,
        };
      }

      // Record mint attempt for rate limiting
      recordMintAttempt(request.buyerAddress);

      // Generate NFT
      const dna = request.dna || this.generateDNA();
      const tokenId = this.mintedCount + 1;
      const nft = this.createNFTState(dna, tokenId);

      // Create PSBT
      const psbt = new bitcoin.Psbt({ network: this.network });

      // Check if P2TR address (Taproot)
      const isP2TR =
        request.buyerAddress.startsWith("bc1p") ||
        request.buyerAddress.startsWith("tb1p");

      // Derive tapInternalKey for P2TR
      let tapInternalKey: Buffer | undefined;
      if (isP2TR && request.buyerPublicKey) {
        // Convert hex public key to x-only (32 bytes)
        // Public key can be 33 bytes (compressed) or 65 bytes (uncompressed)
        const pubKeyHex = request.buyerPublicKey;
        const pubKeyBytes = hexToBytes(pubKeyHex);

        if (pubKeyBytes.length === 33) {
          // Compressed: remove prefix byte (02 or 03), take x-coordinate
          tapInternalKey = Buffer.from(pubKeyBytes.slice(1));
        } else if (pubKeyBytes.length === 32) {
          // Already x-only
          tapInternalKey = Buffer.from(pubKeyBytes);
        } else if (pubKeyBytes.length === 65) {
          // Uncompressed: skip prefix (04), take first 32 bytes (x-coordinate)
          tapInternalKey = Buffer.from(pubKeyBytes.slice(1, 33));
        }
      }

      // Add inputs
      for (const utxo of request.utxos) {
        // Build input data with optional tapInternalKey for P2TR
        const inputData: {
          hash: string;
          index: number;
          witnessUtxo: { script: Buffer; value: number };
          tapInternalKey?: Buffer;
        } = {
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: this.addressToScript(request.buyerAddress),
            value: Number(utxo.value),
          },
        };

        // Add tapInternalKey for P2TR addresses
        if (isP2TR && tapInternalKey) {
          inputData.tapInternalKey = tapInternalKey;
        }

        psbt.addInput(inputData);
      }

      // Output 0: Payment to treasury
      psbt.addOutput({
        address: treasury,
        value: Number(price.priceSats),
      });

      // Output 1: NFT to buyer (with spell data)
      // The spell is encoded in the witness of this output
      const spellData = this.createMintSpell(nft, request.buyerAddress);
      psbt.addOutput({
        address: request.buyerAddress,
        value: Number(NFT_SALE_CONFIG.dustLimit),
      });

      // Output 2: Change (if any)
      const change = totalInput - totalCost;
      if (change > NFT_SALE_CONFIG.dustLimit) {
        psbt.addOutput({
          address: request.buyerAddress,
          value: Number(change),
        });
      }

      // Add spell as OP_RETURN (Charms protocol)
      const spellOpReturn = this.createSpellOpReturn(spellData);
      psbt.addOutput({
        script: spellOpReturn,
        value: 0,
      });

      return {
        success: true,
        psbtHex: psbt.toHex(),
        psbtBase64: psbt.toBase64(),
        nft,
        tokenId,
        totalCost,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Mint failed",
      };
    }
  }

  /**
   * Generate random DNA
   */
  private generateDNA(): string {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return bytesToHex(randomBytes);
  }

  /**
   * Create NFT state from DNA
   */
  private createNFTState(dna: string, tokenId: number): BabyNFTState {
    // Derive traits deterministically from DNA
    const traits = getTraitsFromDNA(dna);

    // Determine rarity based on DNA
    const rarityRoll = parseInt(dna.substring(0, 4), 16) % 1000;
    const rarityTier = this.getRarityFromRoll(rarityRoll);

    // Determine bloodline
    const bloodlineRoll = parseInt(dna.substring(4, 6), 16) % 4;
    const bloodlines: Bloodline[] = ["royal", "warrior", "rogue", "mystic"];
    const bloodline = bloodlines[bloodlineRoll];

    // Determine base type
    const typeRoll = parseInt(dna.substring(6, 10), 16) % 100;
    const baseType = this.getBaseTypeFromRoll(typeRoll);

    return {
      dna,
      bloodline,
      baseType,
      genesisBlock: 0, // Set when mined
      rarityTier,
      tokenId,
      level: 1,
      xp: 0,
      totalXp: 0,
      workCount: 0,
      lastWorkBlock: 0,
      evolutionCount: 0,
      tokensEarned: 0n,
    };
  }

  /**
   * Get rarity from roll (0-999)
   */
  private getRarityFromRoll(roll: number): RarityTier {
    // Common: 50%, Uncommon: 25%, Rare: 15%, Epic: 7%, Legendary: 2.5%, Mythic: 0.5%
    if (roll < 5) return "mythic"; // 0.5%
    if (roll < 30) return "legendary"; // 2.5%
    if (roll < 100) return "epic"; // 7%
    if (roll < 250) return "rare"; // 15%
    if (roll < 500) return "uncommon"; // 25%
    return "common"; // 50%
  }

  /**
   * Get base type from roll (0-99)
   */
  private getBaseTypeFromRoll(roll: number): BaseType {
    if (roll < 1) return "alien"; // 1%
    if (roll < 6) return "robot"; // 5%
    if (roll < 15) return "mystic"; // 9%
    if (roll < 30) return "animal"; // 15%
    return "human"; // 70%
  }

  /**
   * Create mint spell data using proper Charms V2 format
   */
  private createMintSpell(nft: BabyNFTState, recipient: string): SpellV2 {
    // Use the correct spell format from charms/nft.ts
    return createNFTGenesisSpell({
      appId: GENESIS_BABIES_TESTNET4.appId,
      appVk: GENESIS_BABIES_TESTNET4.appVk,
      dna: nft.dna,
      bloodline: nft.bloodline,
      baseType: nft.baseType,
      genesisBlock: 0, // Will be set on confirmation
      rarityTier: nft.rarityTier,
      tokenId: nft.tokenId,
      ownerAddress: recipient,
    });
  }

  /**
   * Create OP_RETURN script for spell
   */
  private createSpellOpReturn(spell: SpellV2): Buffer {
    const spellJson = stringifyWithBigInt(spell);
    const spellBytes = Buffer.from(spellJson, "utf8");

    // Charms protocol: OP_RETURN + "CHARM" + spell data
    const magic = Buffer.from("CHARM", "utf8");

    return bitcoin.script.compile([
      bitcoin.opcodes.OP_RETURN,
      magic,
      spellBytes,
    ]);
  }

  /**
   * Convert address to output script
   */
  private addressToScript(address: string): Buffer {
    return bitcoin.address.toOutputScript(address, this.network);
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createNFTMintService(
  options: MintServiceOptions,
): NFTMintService {
  return new NFTMintService(options);
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { BabyNFTState } from "../charms/nft";
