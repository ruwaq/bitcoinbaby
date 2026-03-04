/**
 * Logging Module
 *
 * @example
 * import { createLogger, LogLevel, logger } from '@bitcoinbaby/shared/logging';
 *
 * // Set global log level
 * logger.setLevel(LogLevel.DEBUG);
 *
 * // Create module logger
 * const log = createLogger('MyModule');
 * log.info('Something happened', { userId: 123 });
 */

export {
  logger,
  createLogger,
  LogLevel,
  type LogEntry,
  type LogHandler,
  type ModuleLogger,
} from "./logger";
