/**
 * Feature Hooks
 *
 * Composite hooks that combine multiple lower-level hooks
 * for simplified usage in section components.
 */

export {
  useBaby,
  type UseBabyOptions,
  type UseBabyReturn,
  type EvolutionData,
} from "./useBaby";

export {
  useMining,
  type UseMiningOptions,
  type UseMiningReturn,
} from "./useMining";

export {
  useWalletDashboard,
  type UseWalletDashboardReturn,
} from "./useWalletDashboard";
