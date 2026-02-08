import { DeadLetterQueue } from './dead-letter-queue';
import { CircuitBreaker } from './circuit-breaker';
import { formatErrorForLogging } from './errors';

/**
 * Decorator to add Dead Letter Queue functionality
 */
export function WithDLQ(
  dlq: DeadLetterQueue,
  metadata?: Record<string, unknown>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        console.error(`[@WithDLQ] Error in ${propertyKey}:`, formatErrorForLogging(error));

        // Extract the event from args (assuming first arg is the event)
        const event = args[0];
        await dlq.add(event, error as Error, { ...metadata, method: propertyKey });

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to add Circuit Breaker functionality
 */
export function WithCircuitBreaker(
  circuitBreaker: CircuitBreaker
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return circuitBreaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Decorator for timeout
 */
export function Timeout(ms: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Method ${propertyKey} timed out after ${ms}ms`)), ms);
      });

      return Promise.race([originalMethod.apply(this, args), timeoutPromise]);
    };

    return descriptor;
  };
}

/**
 * Combined decorator with retry, circuit breaker, and DLQ
 */
export function Resilient(options: {
  circuitBreaker?: CircuitBreaker;
  dlq?: DeadLetterQueue;
  timeout?: number;
  metadata?: Record<string, unknown>;
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    let method = descriptor.value;

    // Apply timeout first
    if (options.timeout) {
      method = Timeout(options.timeout)(target, propertyKey, { value: method }).value;
    }

    // Apply circuit breaker
    if (options.circuitBreaker) {
      method = WithCircuitBreaker(options.circuitBreaker)(target, propertyKey, { value: method }).value;
    }

    // Apply DLQ
    if (options.dlq) {
      method = WithDLQ(options.dlq, options.metadata)(target, propertyKey, { value: method }).value;
    }

    descriptor.value = method;
    return descriptor;
  };
}
