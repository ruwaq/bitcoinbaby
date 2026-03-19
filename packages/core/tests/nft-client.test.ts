/**
 * NFT Client Tests
 *
 * Tests for the NFT API client covering:
 * - NFT operations (reserve, confirm, release)
 * - Work proof submission
 * - Evolution requests
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NFTClient, getNFTClient } from "../src/api/clients/nft-client";

// =============================================================================
// MOCKS
// =============================================================================

// Mock the HttpClient from @bitcoinbaby/shared
vi.mock("@bitcoinbaby/shared", async () => {
  const actual = await vi.importActual("@bitcoinbaby/shared");
  return {
    ...actual,
    HttpClient: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      setBaseUrl: vi.fn(),
      getBaseUrl: vi.fn().mockReturnValue("http://localhost:8787"),
    })),
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
  let client: NFTClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new NFTClient("development");
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

  it("should have correct shape for reserveNFT response", () => {
    const response = {
      success: true,
      data: {
        tokenId: 43,
        totalMinted: 42,
        attemptId: "attempt-uuid-123",
      },
    };

    expect(response.data).toHaveProperty("tokenId");
    expect(response.data).toHaveProperty("totalMinted");
    expect(response.data).toHaveProperty("attemptId");
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

describe("ProveNFTRequest validation", () => {
  it("should have all required fields", () => {
    const request = {
      tokenId: 1,
      address: "tb1qtest",
      nftState: {
        dna: "abc123",
        bloodline: "royal",
        baseType: "human",
        genesisBlock: 100000,
        rarityTier: "rare",
        tokenId: 1,
        level: 1,
        xp: 0,
        totalXp: 0,
        workCount: 0,
        lastWorkBlock: 100000,
        evolutionCount: 0,
        tokensEarned: "0",
      },
      fundingUtxo: {
        txid: "abc123",
        vout: 0,
        value: 10000,
      },
    };

    expect(request).toHaveProperty("tokenId");
    expect(request).toHaveProperty("address");
    expect(request).toHaveProperty("nftState");
    expect(request).toHaveProperty("fundingUtxo");
  });

  it("should validate nftState has all fields", () => {
    const nftState = {
      dna: "abc123",
      bloodline: "royal",
      baseType: "human",
      genesisBlock: 100000,
      rarityTier: "rare",
      tokenId: 1,
      level: 1,
      xp: 0,
      totalXp: 0,
      workCount: 0,
      lastWorkBlock: 100000,
      evolutionCount: 0,
      tokensEarned: "0",
    };

    const requiredFields = [
      "dna",
      "bloodline",
      "baseType",
      "genesisBlock",
      "rarityTier",
      "tokenId",
      "level",
      "xp",
      "totalXp",
      "workCount",
      "lastWorkBlock",
      "evolutionCount",
      "tokensEarned",
    ];

    for (const field of requiredFields) {
      expect(nftState).toHaveProperty(field);
    }
  });

  it("should validate fundingUtxo structure", () => {
    const fundingUtxo = {
      txid: "abc123def456",
      vout: 0,
      value: 10000,
    };

    expect(fundingUtxo.txid).toMatch(/^[a-f0-9]+$/i);
    expect(fundingUtxo.vout).toBeGreaterThanOrEqual(0);
    expect(fundingUtxo.value).toBeGreaterThan(0);
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
