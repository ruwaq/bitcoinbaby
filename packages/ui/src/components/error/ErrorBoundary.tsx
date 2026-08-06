"use client";

/**
 * Error Boundary Components
 *
 * React error boundaries for graceful error handling.
 * Includes specialized boundaries for different contexts.
 */

import { Component, type ReactNode, type ErrorInfo, useState } from "react";
import { PixelIcon } from "../sprites";

// =============================================================================
// TYPES
// =============================================================================

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI to show on error */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Context name for logging */
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// =============================================================================
// CLASS COMPONENT (Required for error boundaries)
// =============================================================================

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={<ErrorFallback />}
 *   onError={(error) => logError('Component crashed', {}, error)}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[ErrorBoundary${this.props.context ? `:${this.props.context}` : ""}]`,
      error,
      errorInfo,
    );
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Custom fallback
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error, this.reset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback
      return (
        <DefaultErrorFallback error={this.state.error} reset={this.reset} />
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// DEFAULT FALLBACK COMPONENTS
// =============================================================================

interface FallbackProps {
  error: Error;
  reset: () => void;
}

/**
 * Default error fallback with pixel art styling
 */
export function DefaultErrorFallback({
  error,
  reset,
}: FallbackProps): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-pixel-bg-dark border-4 border-pixel-error">
      <div className="text-center space-y-4">
        {/* Error icon */}
        <div className="text-4xl mb-2">💥</div>

        <h2 className="font-pixel text-[12px] text-pixel-error uppercase">
          Something went wrong
        </h2>

        <p className="font-pixel-body text-sm text-pixel-text-muted max-w-md">
          {error.message || "An unexpected error occurred"}
        </p>

        <button
          onClick={reset}
          className="font-pixel text-[10px] uppercase px-4 py-2 bg-pixel-primary text-pixel-text-dark border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-transform"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

/**
 * Mining-specific error fallback
 */
export function MiningErrorFallback({
  error,
  reset,
}: FallbackProps): ReactNode {
  const isMiningError =
    error.message.includes("mining") ||
    error.message.includes("worker") ||
    error.message.includes("WebGPU");

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 bg-pixel-bg-medium border-4 border-pixel-warning">
      <div className="text-center space-y-4">
        <PixelIcon
          name="pickaxe"
          size={48}
          className="mx-auto mb-4 text-pixel-warning"
        />

        <h2 className="font-pixel text-[14px] text-pixel-warning uppercase">
          Mining Error
        </h2>

        <p className="font-pixel-body text-sm text-pixel-text-muted max-w-md">
          {isMiningError
            ? "The mining process encountered an issue. This could be due to browser limitations or device capabilities."
            : error.message}
        </p>

        <div className="flex gap-4 mt-6">
          <button
            onClick={reset}
            className="font-pixel text-[10px] uppercase px-4 py-2 bg-pixel-primary text-pixel-text-dark border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-transform"
          >
            Retry Mining
          </button>

          <button
            onClick={() => window.location.reload()}
            className="font-pixel text-[10px] uppercase px-4 py-2 bg-pixel-border text-pixel-text border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-transform"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Wallet-specific error fallback
 */
export function WalletErrorFallback({
  error,
  reset,
}: FallbackProps): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center min-h-[250px] p-6 bg-pixel-bg-medium border-4 border-pixel-error">
      <div className="text-center space-y-4">
        <div className="text-5xl mb-4">🔐</div>

        <h2 className="font-pixel text-[14px] text-pixel-error uppercase">
          Wallet Error
        </h2>

        <p className="font-pixel-body text-sm text-pixel-text-muted max-w-md">
          {error.message ||
            "There was an issue with your wallet. Please try again."}
        </p>

        <button
          onClick={reset}
          className="font-pixel text-[10px] uppercase px-4 py-2 bg-pixel-primary text-pixel-text-dark border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-transform"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

/**
 * NFT-specific error fallback
 */
export function NFTErrorFallback({ error, reset }: FallbackProps): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center min-h-[250px] p-6 bg-pixel-bg-medium border-4 border-[#ec4899]">
      <div className="text-center space-y-4">
        <div className="text-5xl mb-4">👶</div>

        <h2 className="font-pixel text-[14px] text-[#ec4899] uppercase">
          NFT Error
        </h2>

        <p className="font-pixel-body text-sm text-pixel-text-muted max-w-md">
          {error.message || "There was an issue loading your NFTs."}
        </p>

        <button
          onClick={reset}
          className="font-pixel text-[10px] uppercase px-4 py-2 bg-[#ec4899] text-white border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-transform"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// SPECIALIZED BOUNDARIES
// =============================================================================

/**
 * Mining Error Boundary
 */
export function MiningErrorBoundary({
  children,
  onError,
}: {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}): ReactNode {
  return (
    <ErrorBoundary
      context="Mining"
      fallback={(error, reset) => (
        <MiningErrorFallback error={error} reset={reset} />
      )}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Wallet Error Boundary
 */
export function WalletErrorBoundary({
  children,
  onError,
}: {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}): ReactNode {
  return (
    <ErrorBoundary
      context="Wallet"
      fallback={(error, reset) => (
        <WalletErrorFallback error={error} reset={reset} />
      )}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * NFT Error Boundary
 */
export function NFTErrorBoundary({
  children,
  onError,
}: {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}): ReactNode {
  return (
    <ErrorBoundary
      context="NFT"
      fallback={(error, reset) => (
        <NFTErrorFallback error={error} reset={reset} />
      )}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook for handling async errors in components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { error, handleError, clearError } = useAsyncError();
 *
 *   async function fetchData() {
 *     try {
 *       await api.getData();
 *     } catch (e) {
 *       handleError(e);
 *     }
 *   }
 *
 *   if (error) {
 *     return <ErrorDisplay error={error} onRetry={clearError} />;
 *   }
 *
 *   return <Data />;
 * }
 * ```
 */
export function useAsyncError(): {
  error: Error | null;
  handleError: (error: unknown) => void;
  clearError: () => void;
} {
  const [error, setError] = useState<Error | null>(null);

  const handleError = (e: unknown): void => {
    const err = e instanceof Error ? e : new Error(String(e));
    setError(err);
    console.error("[useAsyncError]", err);
  };

  const clearError = (): void => {
    setError(null);
  };

  return { error, handleError, clearError };
}

/**
 * Hook for error recovery with automatic retry
 */
export function useErrorRecovery(
  onRecover: () => void,
  maxRetries: number = 3,
): {
  retryCount: number;
  canRetry: boolean;
  retry: () => void;
  reset: () => void;
} {
  const [retryCount, setRetryCount] = useState(0);

  const canRetry = retryCount < maxRetries;

  const retry = (): void => {
    if (canRetry) {
      setRetryCount((c) => c + 1);
      onRecover();
    }
  };

  const reset = (): void => {
    setRetryCount(0);
  };

  return { retryCount, canRetry, retry, reset };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default ErrorBoundary;
