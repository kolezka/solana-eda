/**
 * Retry handler with exponential backoff
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  detectRateLimit?: boolean;
  rateLimitBaseDelay?: number;
  rateLimitMaxDelay?: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 60000, // 1 minute
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ECONNRESET',
    'ENOTFOUND',
    '580', // Solana RPC timeout
    'RATE_LIMITED',
    '429', // HTTP 429 Too Many Requests
  ],
  detectRateLimit: true,
  rateLimitBaseDelay: 5000, // 5 seconds for rate limits
  rateLimitMaxDelay: 60000, // 1 minute max
};

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('rate limited')
  );
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
  isRateLimit: boolean | undefined,
  rateLimitBaseDelay?: number,
): number {
  if (isRateLimit) {
    // Use more aggressive backoff for rate limits
    const rlBaseDelay = rateLimitBaseDelay ?? baseDelay;
    return Math.min(rlBaseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
  }

  return Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let consecutiveRateLimits = 0;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await fn();

      // Reset rate limit counter on success
      if (consecutiveRateLimits > 0) {
        console.debug(`[Retry] Request succeeded after ${consecutiveRateLimits} rate limits`);
        consecutiveRateLimits = 0;
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      const isRateLimit = opts.detectRateLimit && isRateLimitError(lastError);

      if (isRateLimit) {
        consecutiveRateLimits++;
      }

      // Check if error is retryable
      const isRetryable =
        opts.retryableErrors?.some(
          (err) =>
            lastError!.message.includes(err) || lastError!.message.includes(err.toLowerCase()),
        ) || isRateLimit;

      if (!isRetryable || attempt >= opts.maxAttempts) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = calculateDelay(
        attempt,
        opts.baseDelay,
        opts.maxDelay,
        opts.backoffMultiplier,
        isRateLimit,
        opts.rateLimitBaseDelay,
      );

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay;
      const finalDelay = delay + jitter;

      console.log(
        `[Retry] Attempt ${attempt}/${opts.maxAttempts} failed (${isRateLimit ? 'RATE_LIMIT' : 'ERROR'}), retrying in ${finalDelay.toFixed(0)}ms:`,
        lastError.message.slice(0, 100),
      );

      opts.onRetry?.(attempt, lastError, finalDelay);

      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  throw lastError;
}

/**
 * Decorator for automatic retry
 */
export function Retry(options: Partial<RetryOptions> = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retryWithBackoff(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
