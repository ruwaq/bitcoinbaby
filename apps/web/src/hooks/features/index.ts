/**
 * Feature Hooks
 *
 * Composite hooks that combine multiple lower-level hooks
 * for simplified usage in section components.
 */

export {
  useSpark,
  type UseSparkOptions,
  type UseSparkReturn,
  type EvolutionData,
} from "./useSpark";

export {
  useMining,
  type UseMiningOptions,
  type UseMiningReturn,
} from "./useMining";

export {
  useWalletDashboard,
  type UseWalletDashboardReturn,
} from "./useWalletDashboard";

export { useNFTs, type UseNFTsReturn } from "./useNFTs";
