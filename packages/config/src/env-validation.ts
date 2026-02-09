/**
 * Environment variable validation for workers
 * Provides centralized validation for all worker environment variables
 */

import {
  getRequiredEnv,
  getOptionalEnv,
  getBoolEnv,
  getNumberEnv,
  getArrayEnv,
} from './config.schema';

/**
 * Validation error class
 */
export class EnvValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value?: string,
  ) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: EnvValidationError[];
  warnings: string[];
}

/**
 * Solana network configuration
 */
export interface SolanaNetworkConfig {
  rpcUrl: string;
  wsUrl?: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  isMainnet: boolean;
}

/**
 * Worker-specific environment configuration
 */
export interface WorkerEnvConfig {
  workerName: string;
  redisUrl: string;
  databaseUrl: string;
  solana: SolanaNetworkConfig;
  logLevel: string;
}

/**
 * URL validator
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'ws:', 'wss:', 'redis:', 'postgresql:', 'postgres:'].includes(
      parsed.protocol,
    );
  } catch {
    return false;
  }
}

/**
 * Validate URL format
 */
export function validateUrl(name: string, value: string, required: boolean = true): void {
  if (!value) {
    if (required) {
      throw new EnvValidationError(`Environment variable '${name}' is required`, name);
    }
    return;
  }

  if (!isValidUrl(value)) {
    throw new EnvValidationError(
      `Environment variable '${name}' must be a valid URL, got '${value}'`,
      name,
      value,
    );
  }
}

/**
 * Validate Solana address (base58)
 */
export function isValidSolanaAddress(address: string): boolean {
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Validate Solana address format
 */
export function validateSolanaAddress(name: string, value: string, required: boolean = true): void {
  if (!value) {
    if (required) {
      throw new EnvValidationError(`Environment variable '${name}' is required`, name);
    }
    return;
  }

  if (!isValidSolanaAddress(value)) {
    throw new EnvValidationError(
      `Environment variable '${name}' must be a valid Solana address (base58), got '${value}'`,
      name,
      value,
    );
  }
}

/**
 * Validate number range
 */
export function validateNumberRange(name: string, value: number, min?: number, max?: number): void {
  if (min !== undefined && value < min) {
    throw new EnvValidationError(
      `Environment variable '${name}' must be >= ${min}, got ${value}`,
      name,
      String(value),
    );
  }

  if (max !== undefined && value > max) {
    throw new EnvValidationError(
      `Environment variable '${name}' must be <= ${max}, got ${value}`,
      name,
      String(value),
    );
  }
}

/**
 * Validate numeric threshold (min/max)
 */
export function validateThreshold(
  name: string,
  value: string | undefined,
  min: number,
  max: number,
  defaultValue: number,
): number {
  if (!value) return defaultValue;

  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new EnvValidationError(
      `Environment variable '${name}' must be a number, got '${value}'`,
      name,
      value,
    );
  }

  validateNumberRange(name, parsed, min, max);
  return parsed;
}

/**
 * Base worker environment validator
 */
export class WorkerEnvValidator {
  private errors: EnvValidationError[] = [];
  private warnings: string[] = [];

  /**
   * Add a validation error
   */
  addError(error: EnvValidationError): void {
    this.errors.push(error);
  }

  /**
   * Add a warning
   */
  addWarning(warning: string): void {
    this.warnings.push(warning);
  }

  /**
   * Validate common worker environment variables
   */
  validateCommon(requiredVars: string[] = []): void {
    // Required common variables
    const commonRequired = ['REDIS_URL', 'DATABASE_URL', 'SOLANA_RPC_URL', ...requiredVars];

    for (const varName of commonRequired) {
      const value = process.env[varName];
      if (!value) {
        this.addError(
          new EnvValidationError(`Required environment variable '${varName}' is not set`, varName),
        );
      }
    }

    // Validate URLs
    if (process.env.REDIS_URL) {
      try {
        validateUrl('REDIS_URL', process.env.REDIS_URL);
      } catch (e) {
        this.addError(e as EnvValidationError);
      }
    }

    if (process.env.DATABASE_URL) {
      try {
        validateUrl('DATABASE_URL', process.env.DATABASE_URL);
      } catch (e) {
        this.addError(e as EnvValidationError);
      }
    }

    if (process.env.SOLANA_RPC_URL) {
      try {
        validateUrl('SOLANA_RPC_URL', process.env.SOLANA_RPC_URL);
      } catch (e) {
        this.addError(e as EnvValidationError);
      }
    }

    // Validate optional WebSocket URL
    if (process.env.SOLANA_WS_URL) {
      try {
        validateUrl('SOLANA_WS_URL', process.env.SOLANA_WS_URL, false);
      } catch (e) {
        this.addError(e as EnvValidationError);
      }
    }

    // Validate log level
    const logLevel = process.env.LOG_LEVEL || 'info';
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(logLevel.toLowerCase())) {
      this.addWarning(`LOG_LEVEL '${logLevel}' is not valid, defaulting to 'info'`);
    }
  }

  /**
   * Validate Solana RPC configuration
   */
  validateSolanaConfig(): SolanaNetworkConfig {
    const rpcUrl = getRequiredEnv('SOLANA_RPC_URL');
    validateUrl('SOLANA_RPC_URL', rpcUrl);

    const wsUrl = getOptionalEnv('SOLANA_WS_URL', '');
    if (wsUrl) {
      validateUrl('SOLANA_WS_URL', wsUrl, false);
    }

    const commitment = getOptionalEnv('SOLANA_COMMITMENT', 'confirmed');
    if (commitment !== 'processed' && commitment !== 'confirmed' && commitment !== 'finalized') {
      this.addWarning(`Invalid SOLANA_COMMITMENT '${commitment}', defaulting to 'confirmed'`);
    }

    // Detect network from URL
    const isMainnet = rpcUrl.includes('mainnet') || rpcUrl.includes('api.mainnet-beta.solana.com');

    return {
      rpcUrl,
      wsUrl: wsUrl || undefined,
      commitment: commitment as 'processed' | 'confirmed' | 'finalized',
      isMainnet,
    };
  }

  /**
   * Get validation result
   */
  getResult(): ValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Throw if validation failed
   */
  throwIfInvalid(): void {
    const result = this.getResult();
    if (!result.valid) {
      const messages = result.errors.map((e) => `- ${e.field}: ${e.message}`).join('\n');
      throw new Error(`Environment validation failed:\n${messages}`);
    }
  }
}

/**
 * Market detector specific validation
 */
export function validateMarketDetectorEnv(): WorkerEnvConfig {
  const validator = new WorkerEnvValidator();

  // Common validation
  validator.validateCommon(['WORKER_NAME']);

  // Validate quote mints
  const quoteMints = getArrayEnv('QUOTE_MINTS', ['So11111111111111111111111111111111111111112']);
  for (const mint of quoteMints) {
    try {
      validateSolanaAddress('QUOTE_MINTS', mint);
    } catch (e) {
      validator.addError(e as EnvValidationError);
    }
  }

  // Validate minimum pool size
  const minPoolSize = getNumberEnv('MIN_POOL_SIZE', 1000000000);
  validateNumberRange('MIN_POOL_SIZE', minPoolSize, 1);

  validator.throwIfInvalid();

  return {
    workerName: getRequiredEnv('WORKER_NAME'),
    redisUrl: getRequiredEnv('REDIS_URL'),
    databaseUrl: getRequiredEnv('DATABASE_URL'),
    solana: validator.validateSolanaConfig(),
    logLevel: getOptionalEnv('LOG_LEVEL', 'info'),
  };
}

/**
 * Burn detector specific validation
 */
export function validateBurnDetectorEnv(): WorkerEnvConfig {
  const validator = new WorkerEnvValidator();

  // Common validation
  validator.validateCommon(['WORKER_NAME']);

  // Validate minimum burn threshold
  const minBurnThreshold = getNumberEnv('MIN_BURN_THRESHOLD', 1000000);
  validateNumberRange('MIN_BURN_THRESHOLD', minBurnThreshold, 0);

  // Validate duplicate window
  const duplicateWindow = getNumberEnv('DUPLICATE_WINDOW', 300000);
  validateNumberRange('DUPLICATE_WINDOW', duplicateWindow, 0);

  // Validation settings
  const checkRenounced = getBoolEnv('CHECK_IF_MINT_IS_RENOUNCED', true);
  const checkLocked = getBoolEnv('CHECK_IF_IS_LOCKED', true);

  validator.throwIfInvalid();

  return {
    workerName: getRequiredEnv('WORKER_NAME'),
    redisUrl: getRequiredEnv('REDIS_URL'),
    databaseUrl: getRequiredEnv('DATABASE_URL'),
    solana: validator.validateSolanaConfig(),
    logLevel: getOptionalEnv('LOG_LEVEL', 'info'),
  };
}

/**
 * Liquidity monitor specific validation
 */
export function validateLiquidityMonitorEnv(): WorkerEnvConfig {
  const validator = new WorkerEnvValidator();

  // Common validation
  validator.validateCommon(['WORKER_NAME']);

  // Validate change threshold
  const changeThreshold = getNumberEnv('CHANGE_THRESHOLD', 5);
  validateNumberRange('CHANGE_THRESHOLD', changeThreshold, 0, 100);

  // Validate monitored pools (if provided)
  const monitoredPools = getArrayEnv('MONITORED_POOLS', []);
  for (const pool of monitoredPools) {
    try {
      validateSolanaAddress('MONITORED_POOLS', pool);
    } catch (e) {
      validator.addError(e as EnvValidationError);
    }
  }

  // Auto-subscribe setting
  getBoolEnv('AUTO_SUBSCRIBE_DISCOVERED', true);

  validator.throwIfInvalid();

  return {
    workerName: getRequiredEnv('WORKER_NAME'),
    redisUrl: getRequiredEnv('REDIS_URL'),
    databaseUrl: getRequiredEnv('DATABASE_URL'),
    solana: validator.validateSolanaConfig(),
    logLevel: getOptionalEnv('LOG_LEVEL', 'info'),
  };
}

/**
 * Trading bot specific validation
 */
export function validateTradingBotEnv(): WorkerEnvConfig {
  const validator = new WorkerEnvValidator();

  // Common validation
  validator.validateCommon([
    'WORKER_NAME',
    'TRADING_PRIVATE_KEY', // Required for trading
  ]);

  // Validate private key format (base64)
  const privateKey = getRequiredEnv('TRADING_PRIVATE_KEY');
  try {
    const decoded = Buffer.from(privateKey, 'base64');
    if (decoded.length !== 64) {
      validator.addWarning('TRADING_PRIVATE_KEY should be a 64-byte base64-encoded keypair');
    }
  } catch {
    validator.addError(
      new EnvValidationError('TRADING_PRIVATE_KEY must be valid base64', 'TRADING_PRIVATE_KEY'),
    );
  }

  // Validate trading parameters
  const maxSlippage = getNumberEnv('MAX_SLIPPAGE_BPS', 300);
  validateNumberRange('MAX_SLIPPAGE_BPS', maxSlippage, 0, 10000);

  const maxPositions = getNumberEnv('MAX_POSITIONS', 5);
  validateNumberRange('MAX_POSITIONS', maxPositions, 1, 100);

  const stopLoss = getNumberEnv('STOP_LOSS_PERCENT', 10);
  validateNumberRange('STOP_LOSS_PERCENT', stopLoss, 0, 100);

  const takeProfit = getNumberEnv('TAKE_PROFIT_PERCENT', 50);
  validateNumberRange('TAKE_PROFIT_PERCENT', takeProfit, 0, 1000);

  // Validate tracked tokens
  const trackedTokens = getArrayEnv('TRACKED_TOKENS', []);
  for (const token of trackedTokens) {
    try {
      validateSolanaAddress('TRACKED_TOKENS', token);
    } catch (e) {
      validator.addError(e as EnvValidationError);
    }
  }

  validator.throwIfInvalid();

  return {
    workerName: getRequiredEnv('WORKER_NAME'),
    redisUrl: getRequiredEnv('REDIS_URL'),
    databaseUrl: getRequiredEnv('DATABASE_URL'),
    solana: validator.validateSolanaConfig(),
    logLevel: getOptionalEnv('LOG_LEVEL', 'info'),
  };
}

/**
 * Generic worker environment loader
 */
export function loadWorkerEnv(workerType: string): WorkerEnvConfig {
  switch (workerType) {
    case 'market-detector':
      return validateMarketDetectorEnv();
    case 'burn-detector':
      return validateBurnDetectorEnv();
    case 'liquidity-monitor':
      return validateLiquidityMonitorEnv();
    case 'trading-bot':
      return validateTradingBotEnv();
    default:
      throw new Error(`Unknown worker type: ${workerType}`);
  }
}

/**
 * Validate all environment variables for a worker
 */
export function validateWorkerEnv(workerType: string): ValidationResult {
  const validator = new WorkerEnvValidator();

  try {
    loadWorkerEnv(workerType);
  } catch (e) {
    if (e instanceof EnvValidationError) {
      validator.addError(e);
    } else if (e instanceof Error) {
      // Parse error message for multiple errors
      const lines = e.message.split('\n');
      for (const line of lines) {
        if (line.startsWith('- ')) {
          const parts = line.slice(2).split(': ');
          const field = parts[0];
          const messageParts = parts.slice(1);
          validator.addError(
            new EnvValidationError(
              messageParts.join(': ') || 'Validation failed',
              field || 'unknown',
            ),
          );
        }
      }
    }
  }

  return validator.getResult();
}
