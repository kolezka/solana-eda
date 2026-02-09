/**
 * RabbitMQ Retry Policies
 * Provides different retry strategies for different failure scenarios
 */

export interface RetryPolicy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface RetryAttempt {
  attempt: number;
  delay: number;
  timestamp: string;
}

/**
 * Retry policy presets
 */
export const RetryPolicies: Record<string, RetryPolicy> = {
  /**
   * Immediate retry for transient network errors
   */
  IMMEDIATE: {
    maxAttempts: 3,
    initialDelay: 100, // 100ms
    maxDelay: 500,
    backoffMultiplier: 1.5,
    jitter: true,
  },

  /**
   * Short retry for temporary failures
   */
  SHORT: {
    maxAttempts: 5,
    initialDelay: 1000, // 1s
    maxDelay: 10000, // 10s
    backoffMultiplier: 2,
    jitter: true,
  },

  /**
   * Medium retry for rate limiting
   */
  MEDIUM: {
    maxAttempts: 5,
    initialDelay: 2000, // 2s
    maxDelay: 30000, // 30s
    backoffMultiplier: 2,
    jitter: true,
  },

  /**
   * Long retry for service recovery
   */
  LONG: {
    maxAttempts: 10,
    initialDelay: 5000, // 5s
    maxDelay: 60000, // 60s
    backoffMultiplier: 2,
    jitter: true,
  },

  /**
   * No retry for permanent failures
   */
  NONE: {
    maxAttempts: 1,
    initialDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
};

/**
 * Calculate delay for retry attempt with exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  policy: RetryPolicy
): number {
  const exponentialDelay = policy.initialDelay * Math.pow(policy.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, policy.maxDelay);

  if (policy.jitter) {
    // Add random jitter (±25%)
    const jitterRange = cappedDelay * 0.25;
    return cappedDelay - jitterRange + Math.random() * jitterRange * 2;
  }

  return cappedDelay;
}

/**
 * Execute function with retry policy
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  onRetry?: (attempt: number, delay: number) => void
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < policy.maxAttempts) {
        const delay = calculateRetryDelay(attempt, policy);

        if (onRetry) {
          onRetry(attempt, delay);
        }

        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Execute function with custom retry condition
 */
export async function withRetryConditional<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: Error) => boolean,
  policy: RetryPolicy
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const shouldRetryError = shouldRetry(lastError);
      const canRetry = attempt < policy.maxAttempts;

      if (shouldRetryError && canRetry) {
        const delay = calculateRetryDelay(attempt, policy);
        await sleep(delay);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError;
}

/**
 * Generate retry attempt log
 */
export function generateRetryAttempts(policy: RetryPolicy): RetryAttempt[] {
  const attempts: RetryAttempt[] = [];
  const now = Date.now();

  for (let i = 1; i <= policy.maxAttempts; i++) {
    const delay = calculateRetryDelay(i, policy);
    const timestamp = new Date(now + delay).toISOString();
    attempts.push({ attempt: i, delay, timestamp });
  }

  return attempts;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Common error type checkers
 */
export const ErrorCheckers = {
  isNetworkError: (error: Error): boolean => {
    return (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('network')
    );
  },

  isRateLimitError: (error: Error): boolean => {
    return (
      error.message.includes('rate limit') ||
      error.message.includes('429') ||
      error.message.includes('too many requests')
    );
  },

  isTimeoutError: (error: Error): boolean => {
    return (
      error.message.includes('timeout') ||
      error.message.includes('TIMEDOUT')
    );
  },

  isValidationError: (error: Error): boolean => {
    return (
      error.message.includes('validation') ||
      error.message.includes('invalid') ||
      error.message.includes('schema')
    );
  },

  isPermanentError: (error: Error): boolean => {
    return (
      ErrorCheckers.isValidationError(error) ||
      error.message.includes('not found') ||
      error.message.includes('unauthorized') ||
      error.message.includes('forbidden')
    );
  },
};

/**
 * Get appropriate retry policy based on error type
 */
export function getRetryPolicyForError(error: Error): RetryPolicy {
  if (ErrorCheckers.isNetworkError(error)) {
    return RetryPolicies.MEDIUM as RetryPolicy;
  }

  if (ErrorCheckers.isRateLimitError(error)) {
    return RetryPolicies.LONG as RetryPolicy;
  }

  if (ErrorCheckers.isTimeoutError(error)) {
    return RetryPolicies.SHORT as RetryPolicy;
  }

  if (ErrorCheckers.isPermanentError(error)) {
    return RetryPolicies.NONE as RetryPolicy;
  }

  // Default to short retry for unknown errors
  return RetryPolicies.SHORT as RetryPolicy;
}
