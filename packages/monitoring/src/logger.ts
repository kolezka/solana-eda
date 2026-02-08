/**
 * Structured logging service
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface LoggerOptions {
  level: LogLevel;
  context?: string;
  prettyPrint?: boolean;
  includeTimestamp?: boolean;
  redactedFields?: string[];
}

export class Logger {
  private options: LoggerOptions;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      level: LogLevel.INFO,
      prettyPrint: process.env.NODE_ENV === 'development',
      includeTimestamp: true,
      redactedFields: ['password', 'privateKey', 'secret', 'apiKey', 'token'],
      ...options,
    };
  }

  /**
   * Create a child logger with context
   */
  child(context: string): Logger {
    return new Logger({
      ...this.options,
      context: this.options.context ? `${this.options.context}:${context}` : context,
    });
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.options.level = level;
  }

  /**
   * Check if level is enabled
   */
  private isEnabled(level: LogLevel): boolean {
    return level >= this.options.level;
  }

  /**
   * Redact sensitive fields from log data
   */
  private redact(data: Record<string, unknown>): Record<string, unknown> {
    const redacted = { ...data };

    for (const field of this.options.redactedFields || []) {
      if (field in redacted) {
        redacted[field] = '[REDACTED]';
      }
      // Check nested objects
      for (const key in redacted) {
        if (typeof redacted[key] === 'object' && redacted[key] !== null) {
          if (field in (redacted[key] as Record<string, unknown>)) {
            (redacted[key] as Record<string, unknown>)[field] = '[REDACTED]';
          }
        }
      }
    }

    return redacted;
  }

  /**
   * Format log entry for output
   */
  private format(entry: LogEntry): string {
    if (this.options.prettyPrint) {
      const colorCode = {
        [LogLevel.DEBUG]: '\x1b[36m', // Cyan
        [LogLevel.INFO]: '\x1b[32m',  // Green
        [LogLevel.WARN]: '\x1b[33m',  // Yellow
        [LogLevel.ERROR]: '\x1b[31m', // Red
      };
      const reset = '\x1b[0m';
      const levelName = LogLevel[entry.level];

      const timestamp = this.options.includeTimestamp ? entry.timestamp : '';
      const context = entry.context ? `[${entry.context}]` : '';
      const data = entry.data ? `\n  ${JSON.stringify(entry.data, null, 2)}` : '';
      const error = entry.error ? `\n  ${entry.error.message}${entry.error.stack ? '\n' + entry.error.stack : ''}` : '';

      return `${colorCode[entry.level]}[${levelName}]${reset} ${timestamp} ${context} ${entry.message}${data}${error}`;
    }

    return JSON.stringify({
      ...entry,
      data: entry.data ? this.redact(entry.data) : undefined,
    });
  }

  /**
   * Create log entry
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
    if (!this.isEnabled(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.options.context,
      data: data ? this.redact(data) : undefined,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      } : undefined,
    };

    const formatted = this.format(entry);

    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, data, error);
  }

  /**
   * Log start of an operation
   */
  startOperation(operation: string): () => void {
    const startTime = Date.now();
    this.debug(`Starting: ${operation}`);

    return () => {
      const duration = Date.now() - startTime;
      this.debug(`Completed: ${operation}`, { durationMs: duration });
    };
  }
}

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

export function getLogger(context?: string): Logger {
  if (!globalLogger) {
    const logLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    globalLogger = new Logger({
      level: LogLevel[logLevel as keyof typeof LogLevel] || LogLevel.INFO,
    });
  }

  return context ? globalLogger.child(context) : globalLogger;
}

export function setGlobalLogger(logger: Logger): void {
  globalLogger = logger;
}

/**
 * Log level parser
 */
export function parseLogLevel(level: string): LogLevel {
  const parsed = LogLevel[level.toUpperCase() as keyof typeof LogLevel];
  if (typeof parsed === 'undefined') {
    throw new Error(`Invalid log level: ${level}`);
  }
  return parsed;
}
