/**
 * Durable Object Services
 *
 * Business logic extracted from VirtualBalanceDO.
 */

export {
  processMiningCredit,
  type CreditResult,
  type BoostInfo,
  type VarDiffInfo,
  type MiningCreditDeps,
} from "./mining-credit";

export {
  processAICredit,
  performSemanticAudit,
  type AICreditResult,
  type AIBoostInfo,
  type AICreditDeps,
} from "./ai-credit";
