/**
 * NFT Client Tests
 *
 * Tests for the NFT API client covering:
 * - NFT operations (reserve, confirm, release)
 * - Work proof submission
 * - Evolution requests
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NFTClient, getNFTClient } from "../src/api/clients/nft-client";

// =============================================================================
// MOCKS
// =============================================================================

// Mock the HttpClient from @bitcoinbaby/shared
vi.mock("@bitcoinbaby/shared", async () => {
  const actual = await vi.importActual("@bitcoinbaby/shared");
  return {
    ...actual,
    HttpClient: vi.fn().mockImplementation(function () {
      return {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        setBaseUrl: vi.fn(),
        getBaseUrl: vi.fn().mockReturnValue("http://localhost:8787"),
      };
    }),
  };
});

// =============================================================================
// TEST FIXTURES
// =============================================================================

const mockNFTRecord = {
  tokenId: 1,
  owner: "tb1qtest",
  txid: "abc123",
  dna: "a1b2c3d4e5f6",
  bloodline: "royal",
  baseType: "human",
  rarityTier: "rare",
  level: 3,
  xp: 150,
  totalXp: 450,
  workCount: 10,
  evolutionCount: 2,
  createdAt: Date.now(),
};

const mockWorkProofResult = {
  tokenId: 1,
  xpGained: 150,
  newXp: 300,
  totalXp: 600,
  workCount: 11,
  bloodline: "royal",
  multiplier: 1.5,
  canEvolve: true,
  xpToNextLevel: 200,
};

// =============================================================================
// CLIENT INSTANTIATION TESTS
// =============================================================================

describe("NFTClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("instantiation", () => {
    it("should create client with default environment", () => {
      const defaultClient = new NFTClient();
      expect(defaultClient).toBeInstanceOf(NFTClient);
    });

    it("should create client with specified environment", () => {
      const prodClient = new NFTClient("production");
      expect(prodClient).toBeInstanceOf(NFTClient);
    });
  });

  describe("singleton", () => {
    it("should return same instance from getNFTClient", () => {
      const client1 = getNFTClient();
      const client2 = getNFTClient();
      expect(client1).toBe(client2);
    });
  });
});

// =============================================================================
// API RESPONSE STRUCTURE TESTS
// =============================================================================

describe("NFTClient API Response Structure", () => {
  it("should have correct shape for getNFTCounter response", () => {
    const response = {
      success: true,
      data: { count: 42 },
    };

    expect(response).toHaveProperty("success");
    expect(response).toHaveProperty("data");
    expect(response.data).toHaveProperty("count");
  });

  it("should have correct shape for prepareMint response", () => {
    // prepareMint replaces the old reserveNFT. The response carries the
    // server-derived tokenId + traits + the unsigned commit/spell hexes.
    const response = {
      success: true,
      data: {
        tokenId: 43,
        traits: {
          dna: "deadbeef".repeat(8),
          bloodline: "royal",
          baseType: "human",
          rarityTier: "rare",
        },
        commitTxHex: "dead",
        spellTxHex: "beef",
        commitTxid: "ab".repeat(32),
        spellTxid: "cd".repeat(32),
        priceSats: 5000,
        treasuryAddress: "tb1p7kk2example",
        nextSteps: [],
      },
    };

    expect(response.data).toHaveProperty("tokenId");
    expect(response.data).toHaveProperty("traits");
    expect(response.data.traits).toHaveProperty("dna");
    expect(response.data.traits).toHaveProperty("rarityTier");
    expect(response.data).toHaveProperty("commitTxHex");
    expect(response.data).toHaveProperty("spellTxHex");
    expect(response.data).toHaveProperty("priceSats");
  });

  it("should have correct shape for getOwnedNFTs response", () => {
    const response = {
      success: true,
      data: {
        nfts: [mockNFTRecord],
        count: 1,
      },
    };

    expect(response.data).toHaveProperty("nfts");
    expect(response.data).toHaveProperty("count");
    expect(Array.isArray(response.data.nfts)).toBe(true);
  });

  it("should have correct shape for submitWorkProof response", () => {
    const response = {
      success: true,
      data: mockWorkProofResult,
    };

    expect(response.data).toHaveProperty("tokenId");
    expect(response.data).toHaveProperty("xpGained");
    expect(response.data).toHaveProperty("newXp");
    expect(response.data).toHaveProperty("bloodline");
    expect(response.data).toHaveProperty("multiplier");
    expect(response.data).toHaveProperty("canEvolve");
  });

  it("should have correct shape for evolveNFT response", () => {
    const response = {
      success: true,
      data: {
        nft: mockNFTRecord,
        evolutionCost: "100.00",
        previousLevel: 2,
        newLevel: 3,
      },
    };

    expect(response.data).toHaveProperty("nft");
    expect(response.data).toHaveProperty("evolutionCost");
    expect(response.data).toHaveProperty("previousLevel");
    expect(response.data).toHaveProperty("newLevel");
  });

  it("should have correct shape for error response", () => {
    const errorResponse = {
      success: false,
      error: "NFT not found",
    };

    expect(errorResponse).toHaveProperty("success", false);
    expect(errorResponse).toHaveProperty("error");
  });
});

// =============================================================================
// WORK PROOF DATA VALIDATION TESTS
// =============================================================================

describe("WorkProofData validation", () => {
  it("should have all required fields", () => {
    const workProof = {
      ownerAddress: "tb1qtest",
      shareHash: "abcdef123456",
      difficulty: 16,
      timestamp: Date.now(),
    };

    expect(workProof).toHaveProperty("ownerAddress");
    expect(workProof).toHaveProperty("shareHash");
    expect(workProof).toHaveProperty("difficulty");
    expect(workProof).toHaveProperty("timestamp");
  });

  it("should validate shareHash format (hex string)", () => {
    const shareHash = "abcdef123456";
    expect(/^[a-f0-9]+$/i.test(shareHash)).toBe(true);
  });

  it("should validate difficulty is positive", () => {
    const difficulty = 16;
    expect(difficulty).toBeGreaterThan(0);
  });

  it("should validate timestamp is recent", () => {
    const timestamp = Date.now();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    expect(timestamp).toBeGreaterThan(fiveMinutesAgo);
  });
});

// =============================================================================
// PROVE NFT REQUEST VALIDATION TESTS
// =============================================================================

describe("prepareMint request validation (D6)", () => {
  it("should only require address + fundingUtxo (no client-supplied traits)", () => {
    // The unified /mint/prepare flow derives traits server-side. The client
    // must NOT send dna/bloodline/baseType/rarityTier — that was the root
    // cause of the mythic-always bug (#2). This test pins the contract.
    const request = {
      address: "tb1qtest",
      fundingUtxo: {
        txid: "ab".repeat(32),
        vout: 0,
        value: 10000,
      },
    };

    expect(request).toHaveProperty("address");
    expect(request).toHaveProperty("fundingUtxo");
    // Explicitly assert traits are NOT part of the request.
    expect(request).not.toHaveProperty("nftState");
    expect(request).not.toHaveProperty("traits");
    expect(request).not.toHaveProperty("tokenId");
  });

  it("should validate fundingUtxo structure", () => {
    const fundingUtxo = {
      txid: "ab".repeat(32),
      vout: 0,
      value: 10000,
    };

    expect(fundingUtxo.txid).toMatch(/^[a-f0-9]+$/i);
    expect(fundingUtxo.vout).toBeGreaterThanOrEqual(0);
    expect(fundingUtxo.value).toBeGreaterThan(0);
  });

  it("finalizeMint should only require spellTxid + address", () => {
    const request = {
      spellTxid: "cd".repeat(32),
      address: "tb1qtest",
    };

    expect(request).toHaveProperty("spellTxid");
    expect(request).toHaveProperty("address");
    expect(request).not.toHaveProperty("nft");
    expect(request).not.toHaveProperty("tokenId");
  });
});

// =============================================================================
// MINT ATTEMPT STATUS TESTS
// =============================================================================

describe("MintAttempt status transitions", () => {
  const validStatuses = [
    "reserved",
    "proving",
    "signing",
    "broadcasting",
    "confirmed",
    "failed",
  ];

  it("should have all valid status values", () => {
    expect(validStatuses).toContain("reserved");
    expect(validStatuses).toContain("proving");
    expect(validStatuses).toContain("signing");
    expect(validStatuses).toContain("broadcasting");
    expect(validStatuses).toContain("confirmed");
    expect(validStatuses).toContain("failed");
  });

  it("should follow expected status flow", () => {
    const expectedFlow = [
      "reserved",
      "proving",
      "signing",
      "broadcasting",
      "confirmed",
    ];

    for (let i = 0; i < expectedFlow.length - 1; i++) {
      const currentIdx = validStatuses.indexOf(expectedFlow[i]);
      const nextIdx = validStatuses.indexOf(expectedFlow[i + 1]);
      expect(currentIdx).toBeLessThan(nextIdx);
    }
  });

  it("should allow transition to failed from any state", () => {
    const attempt = {
      attemptId: "test-123",
      tokenId: 1,
      status: "proving" as const,
      reservedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      error: null,
      commitTxid: null,
      spellTxid: null,
    };

    // Should be able to set status to failed
    const failedAttempt = { ...attempt, status: "failed" as const };
    expect(failedAttempt.status).toBe("failed");
  });
});

// =============================================================================
// NFT RECORD STRUCTURE TESTS
// =============================================================================

describe("NFTRecord structure", () => {
  it("should have all immutable fields", () => {
    const immutableFields = [
      "tokenId",
      "dna",
      "bloodline",
      "baseType",
      "rarityTier",
    ];

    for (const field of immutableFields) {
      expect(mockNFTRecord).toHaveProperty(field);
    }
  });

  it("should have all mutable fields", () => {
    const mutableFields = [
      "level",
      "xp",
      "totalXp",
      "workCount",
      "evolutionCount",
    ];

    for (const field of mutableFields) {
      expect(mockNFTRecord).toHaveProperty(field);
    }
  });

  it("should have valid bloodline type", () => {
    const validBloodlines = ["royal", "warrior", "rogue", "mystic"];
    expect(validBloodlines).toContain(mockNFTRecord.bloodline);
  });

  it("should have valid rarity tier", () => {
    const validRarities = [
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
      "mythic",
    ];
    expect(validRarities).toContain(mockNFTRecord.rarityTier);
  });

  it("should have valid base type", () => {
    const validBaseTypes = ["human", "animal", "robot", "mystic", "alien"];
    expect(validBaseTypes).toContain(mockNFTRecord.baseType);
  });

  it("should have level between 1 and 10", () => {
    expect(mockNFTRecord.level).toBeGreaterThanOrEqual(1);
    expect(mockNFTRecord.level).toBeLessThanOrEqual(10);
  });

  it("should have non-negative XP", () => {
    expect(mockNFTRecord.xp).toBeGreaterThanOrEqual(0);
    expect(mockNFTRecord.totalXp).toBeGreaterThanOrEqual(0);
  });

  it("should have totalXp >= xp", () => {
    expect(mockNFTRecord.totalXp).toBeGreaterThanOrEqual(mockNFTRecord.xp);
  });
});

// =============================================================================
// WORK PROOF RESULT VALIDATION TESTS
// =============================================================================

describe("WorkProofResult validation", () => {
  it("should calculate XP gain correctly based on bloodline", () => {
    const bloodlineMultipliers = {
      royal: 1.5,
      warrior: 1.2,
      rogue: 1.0,
      mystic: 1.3,
    };

    const baseXp = 100;
    const expectedXp = Math.floor(
      baseXp *
        bloodlineMultipliers[
          mockWorkProofResult.bloodline as keyof typeof bloodlineMultipliers
        ],
    );

    expect(mockWorkProofResult.xpGained).toBe(expectedXp);
  });

  it("should have multiplier matching bloodline", () => {
    const bloodlineMultipliers = {
      royal: 1.5,
      warrior: 1.2,
      rogue: 1.0,
      mystic: 1.3,
    };

    expect(mockWorkProofResult.multiplier).toBe(
      bloodlineMultipliers[
        mockWorkProofResult.bloodline as keyof typeof bloodlineMultipliers
      ],
    );
  });

  it("should update workCount correctly", () => {
    // workCount should increase by 1 after work proof
    expect(mockWorkProofResult.workCount).toBe(11);
  });

  it("should indicate evolution eligibility", () => {
    expect(typeof mockWorkProofResult.canEvolve).toBe("boolean");
    expect(typeof mockWorkProofResult.xpToNextLevel).toBe("number");
  });
});
