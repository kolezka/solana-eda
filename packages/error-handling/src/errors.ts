/**
 * Custom error classes for the application
 */

export class BaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
    };
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      'NOT_FOUND',
      404,
      { resource, id },
    );
  }
}

export class ConflictError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
  }
}

export class RateLimitError extends BaseError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
  }
}

export class ServiceUnavailableError extends BaseError {
  constructor(service: string, reason?: string) {
    super(
      reason ? `${service} unavailable: ${reason}` : `${service} unavailable`,
      'SERVICE_UNAVAILABLE',
      503,
      { service },
    );
  }
}

export class SolanaRPCError extends BaseError {
  constructor(
    message: string,
    public rpcCode?: number,
    details?: Record<string, unknown>,
  ) {
    super(message, 'SOLANA_RPC_ERROR', 502, details);
  }
}

export class TradingError extends BaseError {
  constructor(
    message: string,
    public tradeId?: string,
    details?: Record<string, unknown>,
  ) {
    super(message, 'TRADING_ERROR', 500, { tradeId, ...details });
  }
}

export class InsufficientLiquidityError extends TradingError {
  constructor(tokenPair: string, required: bigint, available: bigint) {
    super(`Insufficient liquidity for ${tokenPair}`, undefined, {
      tokenPair,
      required: required.toString(),
      available: available.toString(),
    });
  }
}

export class SlippageExceededError extends TradingError {
  constructor(expected: string, actual: string) {
    super(`Slippage tolerance exceeded: expected ${expected}, got ${actual}`, undefined, {
      expected,
      actual,
    });
  }
}

export class PositionError extends BaseError {
  constructor(
    message: string,
    public positionId?: string,
    details?: Record<string, unknown>,
  ) {
    super(message, 'POSITION_ERROR', 400, { positionId, ...details });
  }
}

export class WorkerError extends BaseError {
  constructor(
    message: string,
    public workerName: string,
    details?: Record<string, unknown>,
  ) {
    super(message, 'WORKER_ERROR', 500, { workerName, ...details });
  }
}

/**
 * Error handler middleware for NestJS
 */
export function handleError(error: unknown): BaseError {
  if (error instanceof BaseError) {
    return error;
  }

  if (error instanceof Error) {
    // Convert common errors to our custom types
    if (error.name === 'ValidationError') {
      return new ValidationError(error.message);
    }

    if (error.name === 'NotFoundError') {
      return new NotFoundError('Resource');
    }

    // Generic error
    return new BaseError(error.message, 'INTERNAL_ERROR', 500);
  }

  return new BaseError('An unknown error occurred', 'UNKNOWN_ERROR', 500);
}

/**
 * Type guard for custom errors
 */
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error: unknown): string {
  if (isBaseError(error)) {
    return `[${error.code}] ${error.message}${
      error.details ? ` | ${JSON.stringify(error.details)}` : ''
    }`;
  }

  if (error instanceof Error) {
    return `[${error.name}] ${error.message}`;
  }

  return String(error);
}
