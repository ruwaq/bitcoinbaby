/**
 * Centralized Logging System
 *
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Module-based loggers
 * - Structured logging with metadata
 * - Custom handlers for remote logging
 * - Production-safe (no sensitive data)
 */

// =============================================================================
// TYPES
// =============================================================================

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface LogEntry {
  level: LogLevel;
  levelName: string;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
  requestId?: string;
}

export type LogHandler = (entry: LogEntry) => void;

// =============================================================================
// LOGGER
// =============================================================================

class LoggerService {
  private level: LogLevel = LogLevel.INFO;
  private handlers: LogHandler[] = [];
  private requestId?: string;

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Set request ID for tracing
   */
  setRequestId(id: string | undefined): void {
    this.requestId = id;
  }

  /**
   * Add custom log handler
   */
  addHandler(handler: LogHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index > -1) this.handlers.splice(index, 1);
    };
  }

  /**
   * Clear all handlers
   */
  clearHandlers(): void {
    this.handlers = [];
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    module: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      level,
      levelName: LogLevel[level],
      module,
      message,
      data: this.sanitizeData(data),
      timestamp: Date.now(),
      requestId: this.requestId,
    };

    // Console output
    this.writeToConsole(entry);

    // Custom handlers
    for (const handler of this.handlers) {
      try {
        handler(entry);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Write to console with appropriate method
   */
  private writeToConsole(entry: LogEntry): void {
    const prefix = `[${entry.module}]`;
    const args: unknown[] = [prefix, entry.message];

    if (entry.data && Object.keys(entry.data).length > 0) {
      args.push(entry.data);
    }

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(...args);
        break;
      case LogLevel.INFO:
        console.log(...args);
        break;
      case LogLevel.WARN:
        console.warn(...args);
        break;
      case LogLevel.ERROR:
        console.error(...args);
        break;
    }
  }

  /**
   * Sanitize data to remove sensitive information
   */
  private sanitizeData(
    data?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!data) return undefined;

    const sensitiveKeys = [
      "password",
      "secret",
      "token",
      "key",
      "mnemonic",
      "privateKey",
      "seed",
      "auth",
      "authorization",
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitizeData(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // Public logging methods
  debug(module: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, module, message, data);
  }

  info(module: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, module, message, data);
  }

  warn(module: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, module, message, data);
  }

  error(module: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, module, message, data);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/** Global logger instance */
export const logger = new LoggerService();

/**
 * Create a module-specific logger
 *
 * @example
 * const log = createLogger('Mining');
 * log.info('Mining started');
 * log.error('Mining failed', { error: err.message });
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      logger.debug(module, message, data),
    info: (message: string, data?: Record<string, unknown>) =>
      logger.info(module, message, data),
    warn: (message: string, data?: Record<string, unknown>) =>
      logger.warn(module, message, data),
    error: (message: string, data?: Record<string, unknown>) =>
      logger.error(module, message, data),
  };
}

export type ModuleLogger = ReturnType<typeof createLogger>;
