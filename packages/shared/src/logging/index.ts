/**
 * Logging Module
 *
 * @example
 * import { createLogger, LogLevel, logger, initLogger } from '@bitcoinbaby/shared/logging';
 *
 * // Initialize logger for environment (call once at app start)
 * initLogger(); // Auto-detects prod/dev
 *
 * // Or set global log level manually
 * logger.setLevel(LogLevel.DEBUG);
 *
 * // Create module logger
 * const log = createLogger('MyModule');
 * log.info('Something happened', { userId: 123 });
 */

export {
  logger,
  createLogger,
  initLogger,
  isDebugEnabled,
  LogLevel,
  type LogEntry,
  type LogHandler,
  type ModuleLogger,
} from "./logger";
