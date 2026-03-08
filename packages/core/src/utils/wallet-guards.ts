/**
 * Wallet State Guards
 *
 * Utility functions to validate wallet state before critical operations.
 * Use these guards to prevent operations when wallet is in an invalid state.
 *
 * @example
 * ```ts
 * const guard = createWalletGuard(walletStore.getState());
 *
 * if (!guard.canSign()) {
 *   return { error: guard.getError() };
 * }
 *
 * // Safe to proceed with signing
 * ```
 */

export interface WalletState {
  isConnected: boolean;
  isLocked: boolean;
  wallet: { address: string; publicKey: string } | null;
  signPsbt: ((psbtHex: string) => Promise<string | null>) | null;
}

export interface WalletGuardResult {
  valid: boolean;
  error: string | null;
}

/**
 * Check if wallet can perform read operations (view address, balance)
 */
export function canRead(state: WalletState): WalletGuardResult {
  if (!state.isConnected) {
    return { valid: false, error: "Wallet not connected" };
  }
  if (!state.wallet?.address) {
    return { valid: false, error: "No wallet address available" };
  }
  return { valid: true, error: null };
}

/**
 * Check if wallet can perform signing operations
 */
export function canSign(state: WalletState): WalletGuardResult {
  const readResult = canRead(state);
  if (!readResult.valid) {
    return readResult;
  }

  if (state.isLocked) {
    return {
      valid: false,
      error: "Wallet is locked. Please unlock to continue.",
    };
  }

  if (!state.signPsbt) {
    return {
      valid: false,
      error: "Signing not available. Please unlock wallet.",
    };
  }

  return { valid: true, error: null };
}

/**
 * Check if wallet is ready for transaction (has address and can sign)
 */
export function canTransact(state: WalletState): WalletGuardResult {
  const signResult = canSign(state);
  if (!signResult.valid) {
    return signResult;
  }

  if (!state.wallet?.publicKey) {
    return { valid: false, error: "Public key not available" };
  }

  return { valid: true, error: null };
}

/**
 * Create a guard object for convenience
 */
export function createWalletGuard(state: WalletState) {
  return {
    canRead: () => canRead(state).valid,
    canSign: () => canSign(state).valid,
    canTransact: () => canTransact(state).valid,
    getReadError: () => canRead(state).error,
    getSignError: () => canSign(state).error,
    getTransactError: () => canTransact(state).error,
    state,
  };
}

/**
 * Assert wallet can sign, throws if not
 */
export function assertCanSign(state: WalletState): void {
  const result = canSign(state);
  if (!result.valid) {
    throw new Error(result.error ?? "Cannot sign");
  }
}

/**
 * Assert wallet can transact, throws if not
 */
export function assertCanTransact(state: WalletState): void {
  const result = canTransact(state);
  if (!result.valid) {
    throw new Error(result.error ?? "Cannot transact");
  }
}

export default {
  canRead,
  canSign,
  canTransact,
  createWalletGuard,
  assertCanSign,
  assertCanTransact,
};
