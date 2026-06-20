/**
 * Bitcoin Inscription Module for Genesis Sparks NFTs
 *
 * Complete toolkit for inscribing NFTs on Bitcoin:
 * - PNG Exporter: Convert SVG sprites to optimized PNGs
 * - Sprite Library: Build component library for on-chain storage
 * - On-Chain Renderer: Self-contained HTML renderer
 * - Inscription Builder: Create and broadcast inscriptions
 *
 * @example
 * ```typescript
 * import { getDeploymentSummary, generateInscriptionPlan } from '@bitcoinbaby/bitcoin/inscription';
 *
 * // Get cost estimates
 * const summary = getDeploymentSummary(10); // 10 sat/vB
 * console.log(`Infrastructure cost: $${summary.estimates.estimatedInfrastructureUSD.toFixed(2)}`);
 *
 * // Generate full plan
 * const plan = generateInscriptionPlan({ feeRate: 10 });
 * console.log(`Total inscriptions: ${plan.inscriptions.length}`);
 * ```
 */

// PNG Exporter
export {
  exportSVGtoPNG,
  exportSpriteSheet,
  svgToCanvas,
  generateManifest,
  type PNGExportOptions,
  type ExportResult,
  type SpriteComponent,
  type SpriteManifest,
} from "./png-exporter";

// Sprite Library
export {
  GENESIS_SPARKS_LIBRARY,
  parseDNA,
  getRarityFromScore,
  getBaseTypeFromIndex,
  getBloodlineFromIndex,
  buildSpriteLibrary,
  generateLibraryInscription,
  type SpriteLibrary,
  type SpriteCategory,
  type SpriteComponentDef,
  type ColorPaletteDef,
  type LayerRule,
  type DNAMapping,
  type BuildResult,
  type BuildStats,
} from "./sprite-library";

// On-Chain Renderer
export {
  generateOnChainRenderer,
  minifyRenderer,
  generateRendererInscription,
  generateNFTMetadata,
  generateMinimalNFTInscription,
} from "./onchain-renderer";

// Inscription Builder
export {
  createInscriptionEnvelope,
  estimateInscriptionFee,
  estimateCostUSD,
  generateInscriptionPlan,
  generateNFTInscriptionData,
  buildCommitTransaction,
  buildRevealTransaction,
  getDeploymentSummary,
  INSCRIPTION_ORDER,
  compressBrotli,
  type InscriptionData,
  type InscriptionResult,
  type InscriptionConfig,
  type BatchInscriptionPlan,
} from "./inscription-builder";
