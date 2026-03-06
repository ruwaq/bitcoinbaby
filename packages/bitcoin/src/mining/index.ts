/**
 * Mining Integration Module
 *
 * Connects mining proof-of-work results with Scrolls API for token minting.
 * Updated for Charms Protocol v10 with BRO-style mining flow.
 */

export {
  MiningSubmitter,
  createMiningSubmitter,
  type MiningSubmitterOptions,
  // V9 Types (PoW Direct)
  type SubmissionResultV9,
  // V10 Types (Merkle Proofs)
  type SubmissionResultV10,
  // V11 Types (CLI v11.0.1 - Current)
  type SubmissionResultV11,
} from "./submitter";

export type {
  MiningSubmission,
  SubmissionStatus,
  SubmissionResult,
  MiningProof,
  RewardParams,
} from "./types";
