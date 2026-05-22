#!/usr/bin/env npx tsx
/**
 * Collection Deployment Orchestrator for Genesis Babies
 * 
 * This script runs the automated steps to plan, compress, and simulate
 * the deployment of the Genesis Babies NFT collection on Bitcoin.
 * 
 * Steps:
 * 1. Sprite Library compression and sizing
 * 2. On-Chain HTML Renderer generation and sizing (with injected library ID)
 * 3. Collection Parent Inscription metadata planning
 * 4. Automatic generation of collection-manifest.json
 * 5. Automatic generation of app-metadata.json for charms explorer
 * 
 * Run with:
 *   npx tsx scripts/deploy-collection.ts
 */

import * as fs from "fs";
import * as path from "path";
import { 
  buildSpriteLibrary, 
  generateLibraryInscription,
  compressBrotli,
  estimateInscriptionFee,
  estimateCostUSD,
  generateOnChainRenderer,
  minifyRenderer,
  generateRendererInscription
} from "../packages/bitcoin/src/inscription";

// Configuration
const NETWORK = "testnet4";
const FEE_RATE = 12; // sat/vB
const BTC_PRICE_USD = 100000;

// Application Identity from testnet4 config
const APP_ID = "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b";
const APP_VK = "acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d";

function generateMockId(type: string): string {
  const randomHex = Array.from({ length: 32 }, () => 
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
  ).join("");
  return `${randomHex}i0`;
}

async function main() {
  console.log("=================================================================");
  console.log("   GENESIS BABIES NFT COLLECTION DEPLOYMENT ORCHESTRATOR         ");
  console.log("=================================================================");
  console.log(`Network:      ${NETWORK}`);
  console.log(`Fee Rate:     ${FEE_RATE} sat/vB`);
  console.log(`BTC Price:    $${BTC_PRICE_USD.toLocaleString()} USD`);
  console.log("=================================================================\n");

  const isRealMnemonicSet = !!process.env.MNEMONIC;
  
  if (!isRealMnemonicSet) {
    console.log("ℹ️ [INFO] Running in DRY-RUN / SIMULATION mode.");
    console.log("   To perform a real deployment or custom signature, ensure MNEMONIC is set.");
    console.log("   Writing generated manifests and metadata to disk...\n");
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Sprite Library Inscription
  // ---------------------------------------------------------------------------
  console.log("📦 [1/3] Planning Sprite Library Inscription...");
  const spriteLib = await buildSpriteLibrary();
  const libraryContent = generateLibraryInscription(spriteLib.libraryJson);
  const rawLibraryBytes = new TextEncoder().encode(libraryContent.content);
  const compressedLibrary = compressBrotli(rawLibraryBytes);
  
  const libBytesLength = rawLibraryBytes.length;
  const libCompressedLength = compressedLibrary.length;
  const libFee = estimateInscriptionFee(libCompressedLength, FEE_RATE);
  const libCostUSD = estimateCostUSD(libFee, BTC_PRICE_USD);

  console.log(`   - Raw size:         ${libBytesLength} bytes`);
  console.log(`   - Compressed size:  ${libCompressedLength} bytes (Brotli)`);
  console.log(`   - Savings:          ${((1 - libCompressedLength / libBytesLength) * 100).toFixed(1)}%`);
  console.log(`   - Estimated Fee:    ${libFee.toLocaleString()} sats ($${libCostUSD.toFixed(2)} USD)`);

  const mockLibraryId = generateMockId("library");
  console.log(`   - Inscription ID:   ${mockLibraryId} (Simulated)\n`);

  // ---------------------------------------------------------------------------
  // STEP 2: On-Chain HTML Renderer
  // ---------------------------------------------------------------------------
  console.log("🎨 [2/3] Planning On-Chain HTML Renderer Inscription...");
  const rendererData = generateRendererInscription({
    libraryInscriptionId: mockLibraryId,
    minify: true
  });
  const rawRendererBytes = new TextEncoder().encode(rendererData.content);
  const compressedRenderer = compressBrotli(rawRendererBytes);

  const rendererBytesLength = rawRendererBytes.length;
  const rendererCompressedLength = compressedRenderer.length;
  const rendererFee = estimateInscriptionFee(rendererCompressedLength, FEE_RATE);
  const rendererCostUSD = estimateCostUSD(rendererFee, BTC_PRICE_USD);

  console.log(`   - Raw size:         ${rendererBytesLength} bytes`);
  console.log(`   - Compressed size:  ${rendererCompressedLength} bytes (Brotli)`);
  console.log(`   - Savings:          ${((1 - rendererCompressedLength / rendererBytesLength) * 100).toFixed(1)}%`);
  console.log(`   - Estimated Fee:    ${rendererFee.toLocaleString()} sats ($${rendererCostUSD.toFixed(2)} USD)`);

  const mockRendererId = generateMockId("renderer");
  console.log(`   - Inscription ID:   ${mockRendererId} (Simulated)\n`);

  // ---------------------------------------------------------------------------
  // STEP 3: Collection Parent Inscription
  // ---------------------------------------------------------------------------
  console.log("👑 [3/3] Planning Collection Parent Inscription (Provenance)...");
  
  // The Parent Inscription image could be the official Genesis Babies Logo
  const parentImageSize = 3450; // Estimated 3.4KB logo SVG or PNG
  const parentFee = estimateInscriptionFee(parentImageSize, FEE_RATE);
  const parentCostUSD = estimateCostUSD(parentFee, BTC_PRICE_USD);
  
  const mockParentId = generateMockId("parent");
  console.log(`   - Estimated logo size: ${parentImageSize} bytes`);
  console.log(`   - Estimated Fee:       ${parentFee.toLocaleString()} sats ($${parentCostUSD.toFixed(2)} USD)`);
  console.log(`   - Inscription ID:      ${mockParentId} (Simulated)\n`);

  // Summary of total infrastructure cost
  const totalSats = libFee + rendererFee + parentFee;
  const totalUSD = libCostUSD + rendererCostUSD + parentCostUSD;
  console.log("=================================================================");
  console.log("   INFRASTRUCTURE DEPLOYMENT COST SUMMARY");
  console.log("=================================================================");
  console.log(`Total size to store:  ${(libCompressedLength + rendererCompressedLength + parentImageSize).toLocaleString()} bytes`);
  console.log(`Total estimated fees: ${totalSats.toLocaleString()} sats`);
  console.log(`Total estimated cost: $${totalUSD.toFixed(2)} USD`);
  console.log("=================================================================\n");

  // ---------------------------------------------------------------------------
  // STEP 4: Write collection-manifest.json
  // ---------------------------------------------------------------------------
  const manifestPath = path.resolve(__dirname, "../packages/bitcoin/src/config/collection-manifest.json");
  const manifestContent = {
    network: NETWORK,
    spriteLibraryInscriptionId: mockLibraryId,
    rendererInscriptionId: mockRendererId,
    collectionParentInscriptionId: mockParentId,
    deployedAt: new Date().toISOString()
  };

  console.log(`💾 Writing collection manifest to: ${manifestPath}`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2));

  // ---------------------------------------------------------------------------
  // STEP 5: Write app-metadata.json (Charms Explorer Specification)
  // ---------------------------------------------------------------------------
  const metadataPath = path.resolve(__dirname, "../app-metadata.json");
  const metadataContent = {
    appId: APP_ID,
    appVk: APP_VK,
    name: "Genesis Babies",
    symbol: "GBABY",
    description: "Colección dinámica y evolutiva en la cadena de Bitcoin, con boosts de minería interactivos y evolución de visuales en tiempo real.",
    website: "https://bitcoinbaby.dev",
    logo_inscription_id: mockParentId,
    renderer_inscription_id: mockRendererId,
    state_schema: {
      dna: { type: "string", label: "DNA" },
      bloodline: { type: "string", label: "Bloodline" },
      base_type: { type: "string", label: "Base Type" },
      rarity_tier: { type: "string", label: "Rarity" },
      token_id: { type: "integer", label: "Token ID" },
      level: { type: "integer", label: "Level" },
      xp: { type: "integer", label: "XP" },
      total_xp: { type: "integer", label: "Total XP" },
      tokens_earned: { type: "string", label: "Tokens Earned" }
    }
  };

  console.log(`💾 Writing app metadata for Charms Explorer to: ${metadataPath}`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadataContent, null, 2));

  console.log("\n🎉 [SUCCESS] Simulated deployment completed!");
  console.log("   Use the generated manifests to link your web application configuration.");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
