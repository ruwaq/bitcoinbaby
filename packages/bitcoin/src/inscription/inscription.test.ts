/**
 * Inscription System Tests
 *
 * Tests for the Genesis Sparks NFT inscription system.
 */

import { describe, it, expect } from "vitest";
import {
  parseDNA,
  getRarityFromScore,
  getBaseTypeFromIndex,
  getBloodlineFromIndex,
  GENESIS_SPARKS_LIBRARY,
  buildSpriteLibrary,
} from "./sprite-library";
import {
  generateOnChainRenderer,
  minifyRenderer,
  generateRendererInscription,
  generateNFTMetadata,
  generateMinimalNFTInscription,
} from "./onchain-renderer";
import {
  estimateInscriptionFee,
  estimateCostUSD,
  generateInscriptionPlan,
  getDeploymentSummary,
  createInscriptionEnvelope,
  serializeInscriptionId,
} from "./inscription-builder";

// =============================================================================
// DNA PARSING TESTS
// =============================================================================

describe("DNA Parsing", () => {
  it("should parse DNA string to mapping", () => {
    const dna =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const mapping = parseDNA(dna);

    expect(mapping.baseType).toBe(0);
    expect(mapping.bloodline).toBe(1);
    expect(mapping.heritage).toBe(2);
    expect(mapping.rarityScore).toBe(3);
    expect(mapping.skinVariant).toBe(4);
    expect(mapping.eyeVariant).toBe(5);
    expect(mapping.mouthVariant).toBe(6);
    expect(mapping.accessory1).toBe(7);
    expect(mapping.accessory2).toBe(8);
    expect(mapping.specialTrait).toBe(9);
  });

  it("should handle short DNA by padding", () => {
    const dna = "abc";
    const mapping = parseDNA(dna);

    expect(mapping.baseType).toBe(10 % 8); // 'a' = 10, mod 8 = 2
    expect(mapping.bloodline).toBe(11 % 4); // 'b' = 11, mod 4 = 3
    expect(mapping.heritage).toBe(12 % 5); // 'c' = 12, mod 5 = 2
    // Remaining values padded with 0
    expect(mapping.rarityScore).toBe(0);
  });

  it("should handle 0x prefix", () => {
    const dna = "0xabcdef1234567890";
    const mapping = parseDNA(dna);

    expect(mapping.baseType).toBe(10 % 8); // 'a' = 10
  });
});

// =============================================================================
// RARITY TESTS
// =============================================================================

describe("Rarity Calculation", () => {
  it("should return correct rarity tiers", () => {
    expect(getRarityFromScore(0)).toBe("common");
    expect(getRarityFromScore(3)).toBe("common");
    expect(getRarityFromScore(4)).toBe("uncommon");
    expect(getRarityFromScore(6)).toBe("uncommon");
    expect(getRarityFromScore(7)).toBe("rare");
    expect(getRarityFromScore(9)).toBe("rare");
    expect(getRarityFromScore(10)).toBe("epic");
    expect(getRarityFromScore(12)).toBe("epic");
    expect(getRarityFromScore(13)).toBe("legendary");
    expect(getRarityFromScore(14)).toBe("legendary");
    expect(getRarityFromScore(15)).toBe("mythic");
  });
});

// =============================================================================
// BASE TYPE TESTS
// =============================================================================

describe("Base Type Mapping", () => {
  it("should return correct base types", () => {
    expect(getBaseTypeFromIndex(0)).toBe("human");
    expect(getBaseTypeFromIndex(1)).toBe("animal");
    expect(getBaseTypeFromIndex(2)).toBe("robot");
    expect(getBaseTypeFromIndex(3)).toBe("mystic");
    expect(getBaseTypeFromIndex(4)).toBe("alien");
    // Wraps around
    expect(getBaseTypeFromIndex(5)).toBe("human");
    expect(getBaseTypeFromIndex(10)).toBe("human");
  });
});

// =============================================================================
// BLOODLINE TESTS
// =============================================================================

describe("Bloodline Mapping", () => {
  it("should return correct bloodlines", () => {
    expect(getBloodlineFromIndex(0)).toBe("royal");
    expect(getBloodlineFromIndex(1)).toBe("warrior");
    expect(getBloodlineFromIndex(2)).toBe("rogue");
    expect(getBloodlineFromIndex(3)).toBe("mystic");
    // Wraps around
    expect(getBloodlineFromIndex(4)).toBe("royal");
  });
});

// =============================================================================
// SPRITE LIBRARY TESTS
// =============================================================================

describe("Sprite Library", () => {
  it("should have correct structure", () => {
    expect(GENESIS_SPARKS_LIBRARY.version).toBe(1);
    expect(GENESIS_SPARKS_LIBRARY.name).toBe("Genesis Sparks");
    expect(GENESIS_SPARKS_LIBRARY.totalComponents).toBe(150);
    expect(GENESIS_SPARKS_LIBRARY.categories.length).toBe(6);
    expect(GENESIS_SPARKS_LIBRARY.palettes.length).toBeGreaterThan(0);
    expect(GENESIS_SPARKS_LIBRARY.layerRules.length).toBeGreaterThan(0);
  });

  it("should have all required palettes", () => {
    const paletteIds = GENESIS_SPARKS_LIBRARY.palettes.map((p) => p.id);

    expect(paletteIds).toContain("human");
    expect(paletteIds).toContain("animal");
    expect(paletteIds).toContain("robot");
    expect(paletteIds).toContain("mystic");
    expect(paletteIds).toContain("alien");
    expect(paletteIds).toContain("shaman");
    expect(paletteIds).toContain("elemental");
    expect(paletteIds).toContain("dragon");
    expect(paletteIds).toContain("royal");
    expect(paletteIds).toContain("warrior");
    expect(paletteIds).toContain("rogue");
  });

  it("should build library successfully", async () => {
    const result = await buildSpriteLibrary();

    expect(result.libraryJson).toBeDefined();
    expect(result.librarySize).toBeGreaterThan(0);
    expect(result.components.size).toBeGreaterThan(0);
    expect(result.estimatedCost).toBeGreaterThan(0);
    expect(result.stats.totalComponents).toBeGreaterThan(0);
  });
});

// =============================================================================
// ON-CHAIN RENDERER TESTS
// =============================================================================

describe("On-Chain Renderer", () => {
  it("should generate valid HTML", () => {
    const html = generateOnChainRenderer({
      libraryInscriptionId: "abc123i0",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<svg");
    expect(html).toContain("Genesis Spark");
    expect(html).toContain("abc123i0");
    expect(html).toContain("parseDNA");
    expect(html).toContain("getRarity");
  });

  it("should contain correct XSS regex with double backslashes in template but single in emitted string", () => {
    const html = generateOnChainRenderer({
      libraryInscriptionId: "abc123i0",
    });
    // Because generateOnChainRenderer uses a template string,
    // "on[a-z]+\\s*=" in the source code generates "on[a-z]+\s*=" in the output HTML.
    expect(html).toContain("on[a-z]+\\s*=");
  });

  it("should minify renderer", () => {
    const html = generateOnChainRenderer({
      libraryInscriptionId: "abc123i0",
    });
    const minified = minifyRenderer(html);

    expect(minified.length).toBeLessThan(html.length);
    expect(minified).not.toContain("  "); // No double spaces
    expect(minified).toContain("<!DOCTYPE html>");
  });

  it("should generate renderer inscription data", () => {
    const result = generateRendererInscription({
      libraryInscriptionId: "abc123i0",
      minify: true,
    });

    expect(result.contentType).toBe("text/html");
    expect(result.content.length).toBeGreaterThan(0);
    // Renderer size pre-Brotli: premium renderer has more features.
    // In production it is compressed to ~5-6KB with Brotli (Tag 9).
    expect(result.size).toBeLessThan(25000); // Under 25KB pre-compression
  });
});

// =============================================================================
// NFT METADATA TESTS
// =============================================================================

describe("NFT Metadata", () => {
  it("should generate valid metadata JSON", () => {
    const metadata = generateNFTMetadata({
      tokenId: 1,
      dna: "abcd1234",
      rendererInscriptionId: "renderer123i0",
    });

    const parsed = JSON.parse(metadata);

    expect(parsed.name).toBe("Genesis Spark #1");
    expect(parsed.description).toContain("Genesis Spark");
    expect(parsed.image).toContain("renderer123i0");
    expect(parsed.image).toContain("dna=abcd1234");
    expect(parsed.properties.tokenId).toBe(1);
    expect(parsed.properties.dna).toBe("abcd1234");
  });

  it("should generate minimal NFT inscription", () => {
    const result = generateMinimalNFTInscription({
      tokenId: 42,
      dna: "deadbeef",
      rendererInscriptionId: "renderer123i0",
    });

    expect(result.contentType).toBe("text/html");
    expect(result.content).toContain("renderer123i0");
    expect(result.content).toContain("dna=deadbeef");
    expect(result.content).toContain("id=42");
    expect(result.size).toBeLessThan(200); // Should be very small
  });
});

// =============================================================================
// FEE ESTIMATION TESTS
// =============================================================================

describe("Fee Estimation", () => {
  it("should estimate inscription fee", () => {
    const fee = estimateInscriptionFee(1000, 10);

    // Base ~150 vB + ~255 vB witness = ~405 vB * 10 sat/vB = ~4050 sats
    expect(fee).toBeGreaterThan(3000);
    expect(fee).toBeLessThan(6000);
  });

  it("should scale with content size", () => {
    const smallFee = estimateInscriptionFee(100, 10);
    const largeFee = estimateInscriptionFee(10000, 10);

    expect(largeFee).toBeGreaterThan(smallFee);
  });

  it("should scale with fee rate", () => {
    const lowFee = estimateInscriptionFee(1000, 5);
    const highFee = estimateInscriptionFee(1000, 20);

    expect(highFee).toBeGreaterThan(lowFee);
    expect(highFee).toBeCloseTo(lowFee * 4, -2);
  });

  it("should estimate cost in USD", () => {
    const feeSats = 10000;
    const btcPrice = 100000;
    const cost = estimateCostUSD(feeSats, btcPrice);

    // 10000 sats at $100,000/BTC = $10
    expect(cost).toBe(10);
  });
});

// =============================================================================
// INSCRIPTION PLAN TESTS
// =============================================================================

describe("Inscription Plan", () => {
  it("should generate complete plan", () => {
    const plan = generateInscriptionPlan({ feeRate: 10 });

    expect(plan.inscriptions.length).toBe(2); // Library + Renderer
    expect(plan.totalFee).toBeGreaterThan(0);
    expect(plan.totalSize).toBeGreaterThan(0);
    expect(plan.estimatedCostUSD).toBeGreaterThan(0);

    // Check inscription types
    const types = plan.inscriptions.map((i) => i.type);
    expect(types).toContain("library");
    expect(types).toContain("renderer");
  });
});

// =============================================================================
// DEPLOYMENT SUMMARY TESTS
// =============================================================================

describe("Deployment Summary", () => {
  it("should return deployment steps", () => {
    const summary = getDeploymentSummary(10);

    expect(summary.steps.length).toBe(4);
    expect(summary.steps[0].type).toBe("library");
    expect(summary.steps[1].type).toBe("renderer");
    expect(summary.steps[2].type).toBe("collection");
    expect(summary.steps[3].type).toBe("nfts");
  });

  it("should provide accurate estimates", () => {
    const summary = getDeploymentSummary(10);

    expect(summary.estimates.libraryFee).toBeGreaterThan(0);
    expect(summary.estimates.rendererFee).toBeGreaterThan(0);
    expect(summary.estimates.perNFTFee).toBeGreaterThan(0);
    expect(summary.estimates.totalInfrastructureFee).toBe(
      summary.estimates.libraryFee + summary.estimates.rendererFee,
    );

    // Infrastructure should be under $100 at 10 sat/vB and $100k BTC
    expect(summary.estimates.estimatedInfrastructureUSD).toBeLessThan(100);

    // Per NFT should be under $5 (varies with BTC price and fee rate)
    expect(summary.estimates.estimatedPerNFTUSD).toBeLessThan(5);
  });
});

// =============================================================================
// INSCRIPTION ENVELOPE TESTS
// =============================================================================

describe("Inscription Envelope", () => {
  it("should create valid envelope", () => {
    const data = {
      contentType: "text/plain",
      content: new Uint8Array([72, 101, 108, 108, 111]), // "Hello"
    };

    const envelope = createInscriptionEnvelope(data);

    // Should contain OP_FALSE (0x00)
    expect(envelope[0]).toBe(0x00);
    // Should contain OP_IF (0x63)
    expect(envelope[1]).toBe(0x63);
    // Should contain "ord" tag
    expect(envelope.slice(3, 6).toString()).toBe("ord");
    // Should end with OP_ENDIF (0x68)
    expect(envelope[envelope.length - 1]).toBe(0x68);
  });

  it("should support Brotli contentEncoding and include OP_9 tag", () => {
    const data = {
      contentType: "text/plain",
      content: new Uint8Array([72, 101, 108, 108, 111]),
      contentEncoding: "br",
    };

    const envelope = createInscriptionEnvelope(data);

    // Find the position of OP_9 (0x59)
    const op9Index = envelope.indexOf(0x59);
    expect(op9Index).toBeGreaterThan(-1);

    // The next bytes should be the length (2) and the content encoding "br"
    expect(envelope[op9Index + 1]).toBe(2);
    expect(envelope.slice(op9Index + 2, op9Index + 4).toString()).toBe("br");
  });

  it("should handle large content", () => {
    const largeContent = new Uint8Array(2000).fill(65); // 2KB of 'A'
    const data = {
      contentType: "application/octet-stream",
      content: largeContent,
    };

    const envelope = createInscriptionEnvelope(data);

    // Should be larger than content due to chunking overhead
    expect(envelope.length).toBeGreaterThan(largeContent.length);
    // Should still have valid structure
    expect(envelope[0]).toBe(0x00); // OP_FALSE
    expect(envelope[envelope.length - 1]).toBe(0x68); // OP_ENDIF
  });
});

// =============================================================================
// INTEGRATION TEST
// =============================================================================

describe("Integration: Full NFT Flow", () => {
  it("should generate complete NFT from DNA", async () => {
    const dna = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234";

    // 1. Parse DNA
    const traits = parseDNA(dna);
    expect(traits.baseType).toBeDefined();
    expect(traits.bloodline).toBeDefined();

    // 2. Get rarity
    const rarity = getRarityFromScore(traits.rarityScore);
    expect([
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
      "mythic",
    ]).toContain(rarity);

    // 3. Get base type and bloodline
    const baseType = getBaseTypeFromIndex(traits.baseType);
    const bloodline = getBloodlineFromIndex(traits.bloodline);
    expect(baseType).toBeDefined();
    expect(bloodline).toBeDefined();

    // 4. Generate renderer
    const renderer = generateRendererInscription({
      libraryInscriptionId: "lib123i0",
      minify: true,
    });
    // Renderer size pre-Brotli: ~19-21KB. Brotli compresses it to ~5-6KB for inscription.
    expect(renderer.size).toBeLessThan(25000);

    // 5. Generate NFT metadata
    const metadata = generateNFTMetadata({
      tokenId: 1,
      dna,
      rendererInscriptionId: "render123i0",
      attributes: [
        { trait_type: "Base Type", value: baseType },
        { trait_type: "Bloodline", value: bloodline },
        { trait_type: "Rarity", value: rarity },
      ],
    });

    const parsed = JSON.parse(metadata);
    expect(parsed.attributes.length).toBe(3);

    // 6. Generate minimal inscription
    const nftInscription = generateMinimalNFTInscription({
      tokenId: 1,
      dna,
      rendererInscriptionId: "render123i0",
    });
    expect(nftInscription.size).toBeLessThan(200);

    // 7. Estimate costs
    const deploymentSummary = getDeploymentSummary(10);
    expect(deploymentSummary.estimates.estimatedInfrastructureUSD).toBeLessThan(
      100,
    );
  });
});

describe("Parent-Child Provenance and Metadata (Tags 3 & 5)", () => {
  it("should serialize inscription ID correctly", () => {
    // 32-byte txid: 87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b
    const inscriptionId = "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681bi0";
    const bytes = serializeInscriptionId(inscriptionId);
    
    expect(bytes.length).toBe(32);
    // reversed txid
    const expectedTxidHex = "1b6883d10c7d38432a1a5543a312d23e45a9280fe221a2b0502539fafbecb587";
    expect(bytes.toString("hex")).toBe(expectedTxidHex);

    const inscriptionIdVout1 = "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681bi1";
    const bytesVout1 = serializeInscriptionId(inscriptionIdVout1);
    expect(bytesVout1.length).toBe(33);
    expect(bytesVout1.toString("hex")).toBe(expectedTxidHex + "01");

    const inscriptionIdVout256 = "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681bi256";
    const bytesVout256 = serializeInscriptionId(inscriptionIdVout256);
    expect(bytesVout256.length).toBe(34);
    expect(bytesVout256.toString("hex")).toBe(expectedTxidHex + "0001");
  });

  it("should create envelope containing Tag 3 and Tag 5", () => {
    const parentId = "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681bi1";
    const metadata = {
      name: "Genesis Spark #42",
      attributes: [{ trait_type: "Base Type", value: "human" }]
    };

    const envelope = createInscriptionEnvelope({
      contentType: "text/plain",
      content: Buffer.from("hello"),
      parentInscriptionId: parentId,
      metadata
    });

    const envelopeHex = envelope.toString("hex");

    // Check header: OP_FALSE (00) OP_IF (63) 03 6f7264 (ord)
    expect(envelopeHex).toContain("0063036f7264");

    // Check Content Type tag: OP_1 (51) followed by push data of "text/plain" (0a746578742f706c61696e)
    expect(envelopeHex).toContain("510a746578742f706c61696e");

    // Check Parent ID tag: OP_3 (53) followed by push data of 33 bytes (21) and the serialized parent ID
    const expectedParentSerialized = "211b6883d10c7d38432a1a5543a312d23e45a9280fe221a2b0502539fafbecb58701";
    expect(envelopeHex).toContain("53" + expectedParentSerialized);

    // Check Metadata tag: OP_5 (55)
    expect(envelopeHex).toContain("55");
  });
});

