/**
 * NFT Validation Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { UTXO } from "../../blockchain/types";
import {
  validateAddress,
  validateDNA,
  validateUTXOs,
  validateAmounts,
  validateMintRequest,
  checkRateLimit,
  recordMintAttempt,
  clearRateLimit,
} from "../validation";

describe("NFT Validation", () => {
  describe("validateAddress", () => {
    it("should validate testnet taproot addresses", () => {
      const result = validateAddress(
        "tb1p7kk2fuf8kv5vjftczlezfded94v9ay9s0h7ggd87k5d5ws744lesw7smmu",
        "testnet4",
      );
      expect(result.valid).toBe(true);
    });

    it("should validate mainnet addresses", () => {
      const result = validateAddress(
        "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
        "mainnet",
      );
      expect(result.valid).toBe(true);
    });

    it("should reject empty address", () => {
      const result = validateAddress("", "testnet4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too short");
    });

    it("should reject mainnet address on testnet", () => {
      const result = validateAddress(
        "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
        "testnet4",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("testnet");
    });

    it("should reject testnet address on mainnet", () => {
      const result = validateAddress(
        "tb1p7kk2fuf8kv5vjftczlezfded94v9ay9s0h7ggd87k5d5ws744lesw7smmu",
        "mainnet",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("mainnet");
    });
  });

  describe("validateDNA", () => {
    it("should validate correct DNA", () => {
      const dna =
        "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";
      const result = validateDNA(dna);
      expect(result.valid).toBe(true);
    });

    it("should reject short DNA", () => {
      const result = validateDNA("abc123");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("64");
    });

    it("should reject non-hex DNA", () => {
      const dna =
        "g1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";
      const result = validateDNA(dna);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("hex");
    });
  });

  describe("validateUTXOs", () => {
    const validUTXO = {
      txid: "a".repeat(64),
      vout: 0,
      value: 100000,
      status: { confirmed: true, block_height: 850000 },
    };

    it("should validate correct UTXOs", () => {
      const result = validateUTXOs([validUTXO], 50000n);
      expect(result.valid).toBe(true);
    });

    it("should reject empty UTXOs", () => {
      const result = validateUTXOs([], 50000n);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("No UTXOs");
    });

    it("should reject insufficient funds", () => {
      const result = validateUTXOs([validUTXO], 200000n);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Insufficient");
    });

    it("should warn about dust UTXOs", () => {
      const dustUTXO = { ...validUTXO, value: 500 };
      const result = validateUTXOs([dustUTXO, validUTXO], 1000n);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain("dust");
    });

    it("should reject invalid txid", () => {
      const badUTXO = { ...validUTXO, txid: "invalid" };
      const result = validateUTXOs([badUTXO], 50000n);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("txid");
    });
  });

  describe("validateAmounts", () => {
    it("should validate correct amounts", () => {
      const result = validateAmounts({
        price: 50000n,
        fee: 1000n,
        dustLimit: 546n,
        totalInput: 100000n,
      });
      expect(result.valid).toBe(true);
    });

    it("should reject negative price", () => {
      const result = validateAmounts({
        price: -1n,
        fee: 1000n,
        dustLimit: 546n,
        totalInput: 100000n,
      });
      expect(result.valid).toBe(false);
    });

    it("should reject unreasonably high fee", () => {
      const result = validateAmounts({
        price: 50000n,
        fee: 200_000_000n, // 2 BTC
        dustLimit: 546n,
        totalInput: 1_000_000_000n,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("unreasonably high");
    });
  });

  describe("Rate Limiting", () => {
    const testAddress = "tb1testaddress";

    beforeEach(() => {
      clearRateLimit();
    });

    it("should allow first mint", () => {
      const result = checkRateLimit(testAddress);
      expect(result.valid).toBe(true);
    });

    it("should allow up to 3 mints", () => {
      recordMintAttempt(testAddress);
      recordMintAttempt(testAddress);
      const result = checkRateLimit(testAddress);
      expect(result.valid).toBe(true);
    });

    it("should block after 3 mints", () => {
      recordMintAttempt(testAddress);
      recordMintAttempt(testAddress);
      recordMintAttempt(testAddress);
      const result = checkRateLimit(testAddress);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Rate limit");
    });

    it("should isolate rate limits by address", () => {
      recordMintAttempt(testAddress);
      recordMintAttempt(testAddress);
      recordMintAttempt(testAddress);

      const otherAddress = "tb1otheraddress";
      const result = checkRateLimit(otherAddress);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateMintRequest", () => {
    const validRequest = {
      buyerAddress:
        "tb1p7kk2fuf8kv5vjftczlezfded94v9ay9s0h7ggd87k5d5ws744lesw7smmu",
      utxos: [
        {
          txid: "a".repeat(64),
          vout: 0,
          value: 100000,
          status: { confirmed: true, block_height: 850000 },
        },
      ],
      treasuryAddress:
        "tb1p7kk2fuf8kv5vjftczlezfded94v9ay9s0h7ggd87k5d5ws744lesw7smmu",
      network: "testnet4" as const,
    };

    it("should validate correct mint request", () => {
      const result = validateMintRequest(validRequest);
      expect(result.valid).toBe(true);
    });

    it("should reject invalid buyer address", () => {
      const result = validateMintRequest({
        ...validRequest,
        buyerAddress: "invalid",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Buyer address");
    });

    it("should reject missing treasury", () => {
      const result = validateMintRequest({
        ...validRequest,
        treasuryAddress: "",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Treasury");
    });

    it("should validate DNA if provided", () => {
      const result = validateMintRequest({
        ...validRequest,
        dna: "invalid",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("DNA");
    });
  });
});
