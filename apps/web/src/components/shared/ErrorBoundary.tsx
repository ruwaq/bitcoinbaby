"use client";

/**
 * ErrorBoundary - Isolate section crashes from taking down the entire app.
 *
 * React best practice: every independently-rendered section should have
 * its own error boundary to prevent cascading failures.
 *
 * Usage:
 *   <ErrorBoundary section="mining">
 *     <MiningSection />
 *   </ErrorBoundary>
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Human-readable section name for error reporting */
  section: string;
  /** Content to render */
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryKey: number;
}

const RETRY_DELAY_MS = 300;

export class ErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, retryKey: 0 };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log crash. Use dynamic import so the logger package isn't bundled
    // into every page; it's already loaded by other components.
    import("@bitcoinbaby/shared")
      .then(({ createLogger }) => {
        createLogger?.(`ErrorBoundary[${this.props.section}]`)?.error?.(
          "Section crashed",
          {
            section: this.props.section,
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
          },
        );
      })
      .catch(() => {
        console.error(
          `[ErrorBoundary] ${this.props.section} crashed:`,
          error,
          errorInfo.componentStack,
        );
      });
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private handleRetry = () => {
    // Short delay prevents immediate re-crash flicker on persistent errors.
    // Incrementing retryKey forces children to fully remount instead of
    // re-rendering into the same broken state.
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.setState((prev) => ({
        hasError: false,
        error: null,
        retryKey: prev.retryKey + 1,
      }));
    }, RETRY_DELAY_MS);
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback or default pixel-art styled error UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center"
          role="alert"
          aria-live="assertive"
        >
          {/* Error icon */}
          <div className="w-16 h-16 mb-4 flex items-center justify-center bg-pixel-error/20 border-4 border-pixel-error">
            <span className="font-pixel text-2xl text-pixel-error">!</span>
          </div>

          <h2 className="font-pixel text-sm text-pixel-error mb-2">
            SECTION ERROR
          </h2>

          <p className="font-pixel-body text-xs text-pixel-text-muted mb-1">
            The {this.props.section} section encountered an error.
          </p>

          {/* Show error details in dev */}
          {process.env.NODE_ENV !== "production" && this.state.error && (
            <p className="font-pixel-mono text-[8px] text-pixel-text-muted mt-2 mb-4 max-w-md break-words">
              {this.state.error.message}
            </p>
          )}

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-6 py-3 font-pixel text-[10px] bg-pixel-primary text-black border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-all uppercase"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-6 py-3 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-all uppercase"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

export default ErrorBoundary;
