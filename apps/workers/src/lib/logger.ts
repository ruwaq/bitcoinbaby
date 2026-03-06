/**
 * Structured Logger for Cloudflare Workers
 *
 * Provides consistent, structured logging with:
 * - Log levels (debug, info, warn, error)
 * - Automatic timestamps
 * - Request context (requestId, method, path)
 * - JSON formatting for production
 * - Environment-aware verbosity
 */

import type { Env } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  /** Unique request identifier */
  requestId?: string;
  /** HTTP method */
  method?: string;
  /** Request path */
  path?: string;
  /** Additional context data */
  [key: string]: unknown;
}

export interface LogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Module/component name */
  module: string;
  /** Additional context */
  context?: LogContext;
  /** Error details if applicable */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// =============================================================================
// LOG LEVEL PRIORITY
// =============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// =============================================================================
// LOGGER CLASS
// =============================================================================

export class Logger {
  private module: string;
  private context: LogContext;
  private minLevel: LogLevel;
  private isDev: boolean;

  constructor(
    module: string,
    options: {
      context?: LogContext;
      minLevel?: LogLevel;
      isDev?: boolean;
    } = {},
  ) {
    this.module = module;
    this.context = options.context || {};
    this.minLevel = options.minLevel || "info";
    this.isDev = options.isDev ?? false;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger(this.module, {
      context: { ...this.context, ...context },
      minLevel: this.minLevel,
      isDev: this.isDev,
    });
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  /**
   * Log at info level
   */
  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  /**
   * Log at warn level
   */
  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  /**
   * Log at error level
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: this.isDev ? error.stack : undefined,
          }
        : error
          ? { name: "Unknown", message: String(error) }
          : undefined;

    this.log("error", message, context, errorDetails);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: LogEntry["error"],
  ): void {
    // Check if we should log at this level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      module: this.module,
      context: { ...this.context, ...context },
      error,
    };

    // In development, use human-readable format
    if (this.isDev) {
      this.logDev(entry);
    } else {
      // In production, use JSON for log aggregation
      this.logProd(entry);
    }
  }

  /**
   * Development-friendly log format
   */
  private logDev(entry: LogEntry): void {
    const prefix = `[${entry.module}]`;
    const levelIcon = {
      debug: "🔍",
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
    }[entry.level];

    const contextStr = entry.context
      ? Object.keys(entry.context).length > 0
        ? ` ${JSON.stringify(entry.context)}`
        : ""
      : "";

    const errorStr = entry.error
      ? `\n  Error: ${entry.error.message}${entry.error.stack ? `\n  ${entry.error.stack}` : ""}`
      : "";

    const output = `${levelIcon} ${prefix} ${entry.message}${contextStr}${errorStr}`;

    switch (entry.level) {
      case "debug":
        console.debug(output);
        break;
      case "info":
        console.info(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "error":
        console.error(output);
        break;
    }
  }

  /**
   * Production JSON log format
   */
  private logProd(entry: LogEntry): void {
    // Clean up empty context
    if (entry.context && Object.keys(entry.context).length === 0) {
      delete entry.context;
    }

    const output = JSON.stringify(entry);

    switch (entry.level) {
      case "debug":
      case "info":
        console.log(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "error":
        console.error(output);
        break;
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a logger for a specific module
 */
export function createLogger(module: string, env?: Env): Logger {
  const isDev = env?.ENVIRONMENT === "development";
  const minLevel: LogLevel = isDev ? "debug" : "info";

  return new Logger(module, { minLevel, isDev });
}

/**
 * Create a logger with request context
 */
export function createRequestLogger(
  module: string,
  requestId: string,
  env?: Env,
): Logger {
  const logger = createLogger(module, env);
  return logger.child({ requestId });
}

// =============================================================================
// DEFAULT LOGGERS (for quick access)
// =============================================================================

/** Logger for balance-related operations */
export const balanceLogger = new Logger("Balance");

/** Logger for pool operations */
export const poolLogger = new Logger("Pool");

/** Logger for NFT operations */
export const nftLogger = new Logger("NFT");

/** Logger for leaderboard operations */
export const leaderboardLogger = new Logger("Leaderboard");

/** Logger for admin operations */
export const adminLogger = new Logger("Admin");

/** Logger for scheduled tasks */
export const scheduledLogger = new Logger("Scheduled");

/** Logger for game room operations */
export const gameLogger = new Logger("GameRoom");

/** Logger for redis operations */
export const redisLogger = new Logger("Redis");

/** Logger for treasury signer operations */
export const signerLogger = new Logger("Signer");
