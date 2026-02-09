/**
 * Structured logging with correlation IDs
 * Provides distributed tracing capabilities across the event-driven architecture
 */

import { randomBytes } from 'crypto';

/**
 * Correlation log levels (distinct from base LogLevel to avoid conflicts)
 */
export enum CorrelationLogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Correlation log entry with correlation context
 */
export interface CorrelationLogEntry {
  level: CorrelationLogLevel;
  message: string;
  timestamp: string;
  worker?: string;
  correlationId?: string;
  parentEventId?: string;
  eventId?: string;
  event?: {
    type: string;
    id: string;
    data?: any;
  };
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
  duration?: number; // For operation timing
}

/**
 * Correlation context for tracing
 */
export interface CorrelationContext {
  correlationId: string;
  parentEventId?: string;
  traceId?: string;
  spanId?: string;
  metadata?: Record<string, any>;
}

/**
 * Logger configuration
 */
export interface CorrelationLoggerConfig {
  workerName: string;
  minLevel?: CorrelationLogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
  includeTimestamp?: boolean;
  includeWorker?: boolean;
  redactSensitiveData?: boolean;
}

/**
 * Structured logger with correlation ID support
 */
export class CorrelationLogger {
  private config: CorrelationLoggerConfig;
  private currentContext: CorrelationContext | null = null;

  constructor(config: CorrelationLoggerConfig) {
    this.config = {
      ...config,
      minLevel: config.minLevel || CorrelationLogLevel.INFO,
      enableConsole: config.enableConsole !== false,
      includeTimestamp: config.includeTimestamp !== false,
      includeWorker: config.includeWorker !== false,
      redactSensitiveData: config.redactSensitiveData !== false,
    };
  }

  /**
   * Create a new correlation context
   */
  createContext(parentEventId?: string): CorrelationContext {
    return {
      correlationId: this.generateCorrelationId(),
      parentEventId,
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
    };
  }

  /**
   * Set the current correlation context
   */
  setContext(context: CorrelationContext): void {
    this.currentContext = context;
  }

  /**
   * Get the current correlation context
   */
  getContext(): CorrelationContext | null {
    return this.currentContext;
  }

  /**
   * Clear the current correlation context
   */
  clearContext(): void {
    this.currentContext = null;
  }

  /**
   * Execute function with correlation context
   */
  async withContext<T>(context: CorrelationContext | string, fn: () => Promise<T>): Promise<T> {
    const ctx =
      typeof context === 'string'
        ? { correlationId: context, traceId: this.generateTraceId(), spanId: this.generateSpanId() }
        : context;

    const previousContext = this.currentContext;
    this.currentContext = ctx;

    try {
      return await fn();
    } finally {
      this.currentContext = previousContext;
    }
  }

  /**
   * Log with context
   */
  private log(entry: Omit<CorrelationLogEntry, 'timestamp'>): void {
    // Check log level
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const fullEntry: CorrelationLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      worker: this.config.workerName,
      correlationId: this.currentContext?.correlationId,
      parentEventId: this.currentContext?.parentEventId,
    };

    // Redact sensitive data if enabled
    const sanitizedEntry = this.config.redactSensitiveData
      ? this.redactSensitiveData(fullEntry)
      : fullEntry;

    // Console output
    if (this.config.enableConsole) {
      this.logToConsole(sanitizedEntry);
    }

    // File output (if configured)
    if (this.config.enableFile && this.config.filePath) {
      this.logToFile(sanitizedEntry);
    }
  }

  /**
   * Check if we should log at this level
   */
  private shouldLog(level: CorrelationLogLevel): boolean {
    const levels = [
      CorrelationLogLevel.DEBUG,
      CorrelationLogLevel.INFO,
      CorrelationLogLevel.WARN,
      CorrelationLogLevel.ERROR,
    ];
    const minLevelIndex = levels.indexOf(this.config.minLevel || CorrelationLogLevel.INFO);
    const currentLevelIndex = levels.indexOf(level);
    return currentLevelIndex >= minLevelIndex;
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: CorrelationLogEntry): void {
    const prefix = this.formatPrefix(entry);
    const message = entry.message;
    const metadata = this.formatMetadata(entry);

    const output = `${prefix}${message}${metadata}`;

    switch (entry.level) {
      case CorrelationLogLevel.DEBUG:
        console.debug(output);
        break;
      case CorrelationLogLevel.INFO:
        console.info(output);
        break;
      case CorrelationLogLevel.WARN:
        console.warn(output);
        break;
      case CorrelationLogLevel.ERROR:
        console.error(output);
        if (entry.error?.stack) {
          console.error(entry.error.stack);
        }
        break;
    }
  }

  /**
   * Format log prefix
   */
  private formatPrefix(entry: CorrelationLogEntry): string {
    const parts: string[] = [];

    if (entry.timestamp) {
      parts.push(`[${entry.timestamp}]`);
    }

    if (entry.worker) {
      parts.push(`[${entry.worker}]`);
    }

    if (entry.correlationId) {
      parts.push(`[cid:${entry.correlationId.slice(0, 8)}]`);
    }

    if (entry.event?.id) {
      parts.push(`[event:${entry.event.type}:${entry.event.id.slice(0, 8)}]`);
    }

    if (entry.duration !== undefined) {
      parts.push(`[${entry.duration}ms]`);
    }

    return parts.join(' ') + ' ';
  }

  /**
   * Format metadata for output
   */
  private formatMetadata(entry: CorrelationLogEntry): string {
    const metaParts: string[] = [];

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      const sanitized = this.sanitizeMetadata(entry.metadata);
      metaParts.push(JSON.stringify(sanitized));
    }

    if (entry.event && entry.event.data && Object.keys(entry.event.data).length > 0) {
      const sanitized = this.sanitizeMetadata(entry.event.data);
      metaParts.push(JSON.stringify(sanitized));
    }

    return metaParts.length > 0 ? ' ' + metaParts.join(' ') : '';
  }

  /**
   * Sanitize metadata for logging
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined) {
        continue;
      }

      // Truncate long strings
      if (typeof value === 'string' && value.length > 200) {
        sanitized[key] = value.slice(0, 200) + '...';
        continue;
      }

      // Handle nested objects
      if (typeof value === 'object' && value !== null) {
        if (Buffer.isBuffer(value)) {
          sanitized[key] = `<Buffer ${value.length} bytes>`;
        } else {
          sanitized[key] = value;
        }
        continue;
      }

      sanitized[key] = value;
    }

    return sanitized;
  }

  /**
   * Log to file (simplified - in production use a proper logging library)
   */
  private logToFile(entry: CorrelationLogEntry): void {
    // In production, this would write to a file using a library like Winston or Pino
    // For now, we'll just ignore file logging
  }

  /**
   * Redact sensitive data from log entry
   */
  private redactSensitiveData(entry: CorrelationLogEntry): CorrelationLogEntry {
    const sensitivePatterns = [
      /private[_-]?key/i,
      /secret/i,
      /password/i,
      /token/i,
      /api[_-]?key/i,
      /authorization/i,
    ];

    const redactValue = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(redactValue);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const shouldRedact = sensitivePatterns.some((pattern) => pattern.test(key));

        if (shouldRedact && typeof value === 'string') {
          result[key] = '[REDACTED]';
        } else {
          result[key] = redactValue(value);
        }
      }

      return result;
    };

    return {
      ...entry,
      event: entry.event ? { ...entry.event, data: redactValue(entry.event.data) } : entry.event,
      metadata: entry.metadata ? redactValue(entry.metadata) : entry.metadata,
    };
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }

  /**
   * Debug level log
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log({ level: CorrelationLogLevel.DEBUG, message, metadata });
  }

  /**
   * Info level log
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log({ level: CorrelationLogLevel.INFO, message, metadata });
  }

  /**
   * Warning level log
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log({ level: CorrelationLogLevel.WARN, message, metadata });
  }

  /**
   * Error level log
   */
  error(message: string, error?: Error | unknown, metadata?: Record<string, any>): void {
    let errorObj;

    if (error instanceof Error) {
      errorObj = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    } else if (error) {
      errorObj = {
        name: 'Error',
        message: String(error),
      };
    }

    this.log({ level: CorrelationLogLevel.ERROR, message, error: errorObj, metadata });
  }

  /**
   * Log event with correlation
   */
  logEvent(
    eventType: string,
    eventId: string,
    data?: any,
    level: CorrelationLogLevel = CorrelationLogLevel.INFO,
  ): void {
    this.log({
      level,
      message: `Event: ${eventType}`,
      event: { type: eventType, id: eventId, data },
    });
  }

  /**
   * Log operation with timing
   */
  async logOperation<T>(
    operationName: string,
    fn: () => Promise<T>,
    level: CorrelationLogLevel = CorrelationLogLevel.DEBUG,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      this.log({
        level,
        message: `Operation: ${operationName}`,
        metadata: { operation: operationName, status: 'success', duration },
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.log({
        level: CorrelationLogLevel.ERROR,
        message: `Operation failed: ${operationName}`,
        error: error as Error,
        metadata: { operation: operationName, status: 'error', duration },
        duration,
      });

      throw error;
    }
  }
}

/**
 * Global logger instance
 */
let globalLogger: CorrelationLogger | null = null;

/**
 * Get or create global logger instance
 */
export function getCorrelationLogger(workerName: string): CorrelationLogger {
  if (!globalLogger || globalLogger['config'].workerName !== workerName) {
    globalLogger = new CorrelationLogger({
      workerName,
    });
  }

  return globalLogger;
}

/**
 * Create logger for specific worker
 */
export function createWorkerLogger(
  workerName: string,
  config?: Partial<CorrelationLoggerConfig>,
): CorrelationLogger {
  return new CorrelationLogger({
    workerName,
    ...config,
  });
}

/**
 * Async local storage for correlation context
 * (using a simple Map for Node.js environments)
 */
const contextStorage = new Map<string, any>();

const ASYNC_LOCAL_STORAGE_CONTEXT_KEY = '__correlation_context__';

/**
 * Get correlation context from async local storage
 */
export function getCorrelationContext(): CorrelationContext | undefined {
  return contextStorage.get(ASYNC_LOCAL_STORAGE_CONTEXT_KEY);
}

/**
 * Set correlation context in async local storage
 */
export function setCorrelationContext(context: CorrelationContext): void {
  contextStorage.set(ASYNC_LOCAL_STORAGE_CONTEXT_KEY, context);
}

/**
 * Clear correlation context from async local storage
 */
export function clearCorrelationContext(): void {
  contextStorage.delete(ASYNC_LOCAL_STORAGE_CONTEXT_KEY);
}

/**
 * Extract correlation ID from event
 */
export function extractCorrelationId(event: any): string | undefined {
  return event?.correlationId || event?.id;
}

/**
 * Create correlation context from event
 */
export function createCorrelationFromEvent(event: any): CorrelationContext {
  return {
    correlationId: extractCorrelationId(event) || randomBytes(16).toString('hex'),
    parentEventId: event?.id,
    traceId: randomBytes(16).toString('hex'),
    spanId: randomBytes(8).toString('hex'),
  };
}
