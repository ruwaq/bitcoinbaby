/**
 * Treasury Signer Module
 *
 * External signing service for treasury transactions.
 */

export {
  TreasurySigner,
  createTreasurySigner,
  startTreasurySignerDaemon,
  type SignerConfig,
  type ReadyBatch,
  type SigningResult,
} from "./treasury-signer";
