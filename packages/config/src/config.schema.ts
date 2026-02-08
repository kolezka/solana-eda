/**
 * Configuration schema validation
 */

export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
    port: number;
  };
  database: {
    url: string;
    poolSize: number;
    connectionTimeout: number;
  };
  redis: {
    url: string;
    maxRetries: number;
    retryDelay: number;
  };
  solana: {
    rpcUrl: string;
    wsUrl?: string;
    commitment: 'processed' | 'confirmed' | 'finalized';
    rpcTimeout: number;
    fallbackUrls: string[];
  };
  workers: {
    liquidityMonitor: {
      enabled: boolean;
      pools: string[];
      changeThreshold: number;
      updateInterval: number;
    };
    burnDetector: {
      enabled: boolean;
      minBurnAmount: number;
      duplicateWindow: number;
    };
    tradingBot: {
      enabled: boolean;
      walletPrivateKey?: string;
      maxPositions: number;
      maxSlippage: number;
      stopLossPercent: number;
      takeProfitPercent: number;
      minBurnAmount: number;
      positionSizing: 'FIXED' | 'PERCENTAGE_OF_PORTFOLIO' | 'RISK_BASED' | 'KELLY_CRITERION';
      maxPositionSize: number;
      portfolioPercent: number;
      riskPerTrade: number;
      winRate: number;
      avgWin: number;
      avgLoss: number;
    };
  };
  monitoring: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    metrics: {
      enabled: boolean;
      port: number;
    };
    healthCheck: {
      enabled: boolean;
      interval: number;
    };
  };
  security: {
    rateLimiting: {
      enabled: boolean;
      maxRequests: number;
      windowMs: number;
    };
    cors: {
      enabled: boolean;
      origins: string[];
    };
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<AppConfig> = {
  app: {
    name: 'solana-eda',
    version: '1.0.0',
    environment: 'development',
    port: 3000,
  },
  database: {
    url: 'postgresql://localhost:5432/solana_eda',
    poolSize: 10,
    connectionTimeout: 30000,
  },
  redis: {
    url: 'redis://localhost:6379',
    maxRetries: 3,
    retryDelay: 1000,
  },
  solana: {
    rpcUrl: 'https://api.devnet.solana.com',
    commitment: 'confirmed',
    rpcTimeout: 30000,
    fallbackUrls: [],
  },
  workers: {
    liquidityMonitor: {
      enabled: true,
      pools: [],
      changeThreshold: 5,
      updateInterval: 60000,
    },
    burnDetector: {
      enabled: true,
      minBurnAmount: 1000000,
      duplicateWindow: 300000,
    },
    tradingBot: {
      enabled: false,
      maxPositions: 5,
      maxSlippage: 0.03,
      stopLossPercent: 0.1,
      takeProfitPercent: 0.5,
      minBurnAmount: 1000000,
      positionSizing: 'RISK_BASED',
      maxPositionSize: 1000,
      portfolioPercent: 0.05,
      riskPerTrade: 0.01,
      winRate: 0.5,
      avgWin: 0.2,
      avgLoss: 0.1,
    },
  },
  monitoring: {
    enabled: true,
    logLevel: 'info',
    metrics: {
      enabled: true,
      port: 9090,
    },
    healthCheck: {
      enabled: true,
      interval: 30000,
    },
  },
  security: {
    rateLimiting: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000,
    },
    cors: {
      enabled: true,
      origins: ['http://localhost:3000'],
    },
  },
};

/**
 * Environment-specific overrides
 */
export const ENVIRONMENT_CONFIGS: Record<string, Partial<AppConfig>> = {
  development: {
    app: {
      name: 'solana-eda',
      version: '1.0.0',
      environment: 'development',
      port: 3000,
    },
    monitoring: {
      enabled: true,
      logLevel: 'debug',
      metrics: {
        enabled: true,
        port: 9090,
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
      },
    },
  },
  staging: {
    app: {
      name: 'solana-eda',
      version: '1.0.0',
      environment: 'staging',
      port: 3001,
    },
    monitoring: {
      enabled: true,
      logLevel: 'info',
      metrics: {
        enabled: true,
        port: 9090,
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
      },
    },
  },
  production: {
    app: {
      name: 'solana-eda',
      version: '1.0.0',
      environment: 'production',
      port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    },
    monitoring: {
      enabled: true,
      logLevel: 'warn',
      metrics: {
        enabled: true,
        port: 9090,
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
      },
    },
  },
};

/**
 * Validate required environment variables
 */
export function validateEnv(requiredVars: string[]): void {
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Get required environment variable or throw
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable '${name}' is not set`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Parse boolean environment variable
 */
export function getBoolEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.toLowerCase();
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

/**
 * Parse number environment variable
 */
export function getNumberEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable '${name}' must be a number, got '${value}'`);
  }
  return parsed;
}

/**
 * Parse array environment variable (comma-separated)
 */
export function getArrayEnv(name: string, defaultValue: string[]): string[] {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
