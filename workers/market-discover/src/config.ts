/**
 * Configuration for the market-discover worker
 * Loads environment variables and provides typed configuration
 */

interface Config {
  // Solana RPC configuration
  solanaRpcUrl: string;
  solanaWsUrl?: string;

  // Quote mints to monitor for new markets
  quoteMints: string[];

  // Redis configuration
  redisUrl: string;

  // Worker identification
  workerName: string;

  // Deduplication window (ms)
  deduplicationWindowMs: number;

  // Polling interval for market discovery (ms)
  discoveryIntervalMs: number;

  // OpenBook program IDs
  openbookProgramId: string;
  openbookV2ProgramId: string;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value ?? defaultValue ?? '';
}

function parseStringList(value: string, defaultValue: string[]): string[] {
  if (!value || value.trim() === '') {
    return defaultValue;
  }
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function loadConfig(): Config {
  return {
    solanaRpcUrl: getEnvVar(
      'SOLANA_RPC_URL',
      'https://api.devnet.solana.com',
    ),
    solanaWsUrl: getEnvVar('SOLANA_WS_URL'),
    quoteMints: parseStringList(
      getEnvVar('QUOTE_MINTS', ''),
      [
        // USDC devnet
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      ],
    ),
    redisUrl: getEnvVar('REDIS_URL', 'redis://localhost:6379'),
    workerName: getEnvVar('WORKER_NAME', 'market-discover'),
    deduplicationWindowMs: parseInt(
      getEnvVar('DEDUPLICATION_WINDOW_MS', '300000'), // 5 minutes
      10,
    ),
    discoveryIntervalMs: parseInt(
      getEnvVar('DISCOVERY_INTERVAL_MS', '60000'), // 1 minute
      10,
    ),
    openbookProgramId: getEnvVar(
      'OPENBOOK_PROGRAM_ID',
      'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX',
    ),
    openbookV2ProgramId: getEnvVar(
      'OPENBOOK_V2_PROGRAM_ID',
      'opnb2LAfJYbBMAqJfpSkHg3XV55hukunQEHy2Ybto5v',
    ),
  };
}

export const config = loadConfig();
