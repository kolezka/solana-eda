import type { AppConfig } from './config.schema';
import {
  DEFAULT_CONFIG,
  ENVIRONMENT_CONFIGS,
  getRequiredEnv,
  getOptionalEnv,
  getBoolEnv,
  getNumberEnv,
  getArrayEnv,
} from './config.schema';

/**
 * Configuration service for managing application configuration
 */
export class ConfigService {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from environment and defaults
   */
  private loadConfig(): AppConfig {
    const environment = (getOptionalEnv('NODE_ENV', 'development') || 'development') as 'development' | 'staging' | 'production';

    // Start with defaults
    let config: any = { ...DEFAULT_CONFIG };

    // Apply environment-specific overrides
    if (ENVIRONMENT_CONFIGS[environment]) {
      config = this.deepMerge(config, ENVIRONMENT_CONFIGS[environment]);
    }

    // Override with environment variables
    config = this.loadFromEnv(config);

    // Validate required configuration
    this.validateConfig(config);

    return config as AppConfig;
  }

  /**
   * Load configuration values from environment variables
   */
  private loadFromEnv(config: any): any {
    return {
      ...config,
      app: {
        ...config.app,
        name: getOptionalEnv('APP_NAME', config.app?.name || 'solana-eda'),
        version: getOptionalEnv('APP_VERSION', config.app?.version || '1.0.0'),
        environment: getOptionalEnv('NODE_ENV', config.app?.environment || 'development'),
        port: getNumberEnv('PORT', config.app?.port || 3000),
      },
      database: {
        ...config.database,
        url: getRequiredEnv('DATABASE_URL'),
        poolSize: getNumberEnv('DATABASE_POOL_SIZE', config.database?.poolSize || 10),
        connectionTimeout: getNumberEnv('DATABASE_CONNECTION_TIMEOUT', config.database?.connectionTimeout || 30000),
      },
      redis: {
        ...config.redis,
        url: getOptionalEnv('REDIS_URL', config.redis?.url || 'redis://localhost:6379'),
        maxRetries: getNumberEnv('REDIS_MAX_RETRIES', config.redis?.maxRetries || 3),
        retryDelay: getNumberEnv('REDIS_RETRY_DELAY', config.redis?.retryDelay || 1000),
      },
      solana: {
        ...config.solana,
        rpcUrl: getOptionalEnv('SOLANA_RPC_URL', config.solana?.rpcUrl || 'https://api.mainnet-beta.solana.com'),
        wsUrl: getOptionalEnv('SOLANA_WS_URL', config.solana?.wsUrl),
        commitment: getOptionalEnv('SOLANA_COMMITMENT', config.solana?.commitment || 'confirmed') as any,
        rpcTimeout: getNumberEnv('SOLANA_RPC_TIMEOUT', config.solana?.rpcTimeout || 30000),
        fallbackUrls: getArrayEnv('SOLANA_FALLBACK_URLS', config.solana?.fallbackUrls || []),
      },
      workers: {
        ...config.workers,
        liquidityMonitor: {
          ...config.workers?.liquidityMonitor,
          enabled: getBoolEnv('LIQUIDITY_MONITOR_ENABLED', config.workers?.liquidityMonitor?.enabled ?? true),
          pools: getArrayEnv('MONITORED_POOLS', config.workers?.liquidityMonitor?.pools || []),
          changeThreshold: getNumberEnv('CHANGE_THRESHOLD', config.workers?.liquidityMonitor?.changeThreshold || 5),
          updateInterval: getNumberEnv('LIQUIDITY_UPDATE_INTERVAL', config.workers?.liquidityMonitor?.updateInterval || 60000),
        },
        burnDetector: {
          ...config.workers?.burnDetector,
          enabled: getBoolEnv('BURN_DETECTOR_ENABLED', config.workers?.burnDetector?.enabled ?? true),
          minBurnAmount: getNumberEnv('MIN_BURN_THRESHOLD', config.workers?.burnDetector?.minBurnAmount || 1000000),
          duplicateWindow: getNumberEnv('DUPLICATE_WINDOW', config.workers?.burnDetector?.duplicateWindow || 300000),
        },
        tradingBot: {
          ...config.workers?.tradingBot,
          enabled: getBoolEnv('TRADING_BOT_ENABLED', config.workers?.tradingBot?.enabled ?? false),
          walletPrivateKey: process.env.TRADING_PRIVATE_KEY,
          maxPositions: getNumberEnv('MAX_POSITIONS', config.workers?.tradingBot?.maxPositions || 5),
          maxSlippage: getNumberEnv('MAX_SLIPPAGE', config.workers?.tradingBot?.maxSlippage || 0.03) / 100,
          stopLossPercent: getNumberEnv('STOP_LOSS_PERCENT', config.workers?.tradingBot?.stopLossPercent || 10) / 100,
          takeProfitPercent: getNumberEnv('TAKE_PROFIT_PERCENT', config.workers?.tradingBot?.takeProfitPercent || 50) / 100,
          minBurnAmount: getNumberEnv('MIN_BURN_AMOUNT', config.workers?.tradingBot?.minBurnAmount || 1000000),
          positionSizing: getOptionalEnv('POSITION_SIZING', config.workers?.tradingBot?.positionSizing || 'RISK_BASED') as any,
          maxPositionSize: getNumberEnv('MAX_POSITION_SIZE', config.workers?.tradingBot?.maxPositionSize || 1000),
          portfolioPercent: getNumberEnv('PORTFOLIO_PERCENT', config.workers?.tradingBot?.portfolioPercent || 5) / 100,
          riskPerTrade: getNumberEnv('RISK_PER_TRADE', config.workers?.tradingBot?.riskPerTrade || 1) / 100,
        },
      },
      monitoring: {
        ...config.monitoring,
        enabled: getBoolEnv('MONITORING_ENABLED', config.monitoring?.enabled ?? true),
        logLevel: getOptionalEnv('LOG_LEVEL', config.monitoring?.logLevel || 'info') as any,
        metrics: {
          ...config.monitoring?.metrics,
          enabled: getBoolEnv('METRICS_ENABLED', config.monitoring?.metrics?.enabled ?? true),
          port: getNumberEnv('METRICS_PORT', config.monitoring?.metrics?.port || 9090),
        },
        healthCheck: {
          ...config.monitoring?.healthCheck,
          enabled: getBoolEnv('HEALTH_CHECK_ENABLED', config.monitoring?.healthCheck?.enabled ?? true),
          interval: getNumberEnv('HEALTH_CHECK_INTERVAL', config.monitoring?.healthCheck?.interval || 30000),
        },
      },
      security: {
        ...config.security,
        rateLimiting: {
          ...config.security?.rateLimiting,
          enabled: getBoolEnv('RATE_LIMITING_ENABLED', config.security?.rateLimiting?.enabled ?? true),
          maxRequests: getNumberEnv('RATE_LIMIT_MAX_REQUESTS', config.security?.rateLimiting?.maxRequests || 100),
          windowMs: getNumberEnv('RATE_LIMIT_WINDOW_MS', config.security?.rateLimiting?.windowMs || 60000),
        },
        cors: {
          ...config.security?.cors,
          enabled: getBoolEnv('CORS_ENABLED', config.security?.cors?.enabled ?? true),
          origins: getArrayEnv('CORS_ORIGINS', config.security?.cors?.origins || ['http://localhost:3000']),
        },
      },
    };
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: any): void {
    // Required fields
    if (!config.database?.url) {
      throw new Error('DATABASE_URL is required');
    }

    // Validate trading bot has private key if enabled
    if (config.workers?.tradingBot?.enabled && !config.workers?.tradingBot?.walletPrivateKey) {
      console.warn('[Config] Trading bot is enabled but TRADING_PRIVATE_KEY is not set. A new wallet will be generated.');
    }

    // Validate URLs
    this.validateUrl(config.solana?.rpcUrl, 'SOLANA_RPC_URL');
    if (config.solana?.wsUrl) {
      this.validateUrl(config.solana.wsUrl, 'SOLANA_WS_URL', true);
    }

    // Validate percentages
    const tradingBot = config.workers?.tradingBot;
    if (tradingBot) {
      this.validatePercentage(tradingBot.maxSlippage, 'MAX_SLIPPAGE');
      this.validatePercentage(tradingBot.stopLossPercent, 'STOP_LOSS_PERCENT');
      this.validatePercentage(tradingBot.takeProfitPercent, 'TAKE_PROFIT_PERCENT');
    }
  }

  private validateUrl(url: string, name: string, optional = false): void {
    if (!url) {
      if (!optional) {
        throw new Error(`${name} is required`);
      }
      return;
    }

    try {
      new URL(url);
    } catch {
      throw new Error(`${name} must be a valid URL: ${url}`);
    }
  }

  private validatePercentage(value: number, name: string): void {
    if (typeof value !== 'number' || value < 0 || value > 1) {
      throw new Error(`${name} must be a percentage between 0 and 1, got: ${value}`);
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  private isObject(item: unknown): item is Record<string, unknown> {
    return item !== null && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Get the full configuration
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Get a specific configuration value by path
   */
  get<T = any>(path: string): T {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        throw new Error(`Configuration path '${path}' not found`);
      }
    }

    return value as T;
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.config.app.environment === 'development';
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.config.app.environment === 'production';
  }

  /**
   * Check if running in staging
   */
  isStaging(): boolean {
    return this.config.app.environment === 'staging';
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof AppConfig['workers']): boolean {
    return this.config.workers[feature]?.enabled ?? false;
  }

  /**
   * Get worker configuration
   */
  getWorkerConfig<T extends keyof AppConfig['workers']>(worker: T): AppConfig['workers'][T] {
    return this.config.workers[worker];
  }
}

/**
 * Singleton configuration service instance
 */
let configServiceInstance: ConfigService | null = null;

export function getConfigService(): ConfigService {
  if (!configServiceInstance) {
    configServiceInstance = new ConfigService();
  }
  return configServiceInstance;
}
