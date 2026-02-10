import {
  Connection,
  PublicKey,
  Commitment,
  AccountInfo,
} from '@solana/web3.js';
import {
  MARKET_STATE_LAYOUT_V3,
  MAINNET_PROGRAM_ID,
} from '@raydium-io/raydium-sdk';
import type {
  MarketState,
  MarketFilters,
  MarketDiscoveryCallback,
  MarketErrorCallback,
  OpenBookClientConfig,
  AccountChangeResult,
} from './types.js';

/**
 * OpenBook program IDs
 */
const OPENBOOK_PROGRAM_IDS = {
  MAINNET: new PublicKey('srmqPvymJeFQ6fTL15sRKbGtWxGWKbLFXfNxGVqY5n'),
  DEVNET: new PublicKey('DEXy5ZkeTMYnp4ASd1zHkmXDJqt ZwzdSuBvZgHPoEED'),
};

/**
 * Default quote mints to monitor
 */
const DEFAULT_QUOTE_MINTS = {
  USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  RAY: new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
};

/**
 * OpenBook Market Discovery Client
 *
 * Monitors for new OpenBook markets using onProgramAccountChange
 * with filtering by dataSize and memcmp for quote mint.
 */
export class OpenBookClient {
  private connection: Connection;
  private config: OpenBookClientConfig;
  private subscriptionId: number | null = null;
  private isMonitoring = false;

  /**
   * Create a new OpenBookClient
   */
  constructor(config: OpenBookClientConfig) {
    this.connection = config.connection;
    this.config = {
      ...config,
      programId: config.programId || OPENBOOK_PROGRAM_IDS.MAINNET,
      filters: config.filters || {},
    };
  }

  /**
   * Start monitoring for new markets
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    const programId = this.config.programId!;
    const commitment = this.config.filters?.commitment || 'confirmed';

    // Build filters
    const filters = this.buildFilters();

    try {
      // Subscribe to program account changes
      const subscription = this.connection.onProgramAccountChange(
        programId,
        (keyedAccountInfo, context) => {
          const result: AccountChangeResult = {
            account_id: keyedAccountInfo.accountId.toString(),
            account_info: {
              data: Buffer.from(keyedAccountInfo.accountInfo.data),
              owner: keyedAccountInfo.accountInfo.owner,
              executable: keyedAccountInfo.accountInfo.executable,
              lamports: keyedAccountInfo.accountInfo.lamports,
            },
            context: {
              slot: context.slot,
            },
          };
          this.handleAccountChange(result);
        },
        commitment,
        filters
      );

      this.subscriptionId = subscription as unknown as number;
      this.isMonitoring = true;
    } catch (error) {
      await this.handleError(error as Error);
    }
  }

  /**
   * Build filters for market discovery
   */
  private buildFilters(): any[] {
    const filters: any[] = [];

    // Filter by market state data size
    filters.push({
      dataSize: MARKET_STATE_LAYOUT_V3.span,
    });

    // Filter by quote mint if specified
    const quoteMint = this.config.filters?.quoteMint;
    if (quoteMint) {
      const quoteMintPubkey =
        quoteMint instanceof PublicKey
          ? quoteMint
          : new PublicKey(quoteMint);

      const quoteMintOffset = MARKET_STATE_LAYOUT_V3.offsetOf('quoteMint');

      filters.push({
        memcmp: {
          offset: quoteMintOffset,
          bytes: quoteMintPubkey.toBase58(),
        },
      });
    }

    return filters;
  }

  /**
   * Handle account change callback
   */
  private async handleAccountChange(
    result: AccountChangeResult
  ): Promise<void> {
    try {
      const market = this.decodeMarketState(result);
      if (!market) {
        return;
      }

      // Apply additional filters
      if (!this.passesFilters(market)) {
        return;
      }

      // Emit discovered market
      await this.config.onMarketDiscovered(market);
    } catch (error) {
      await this.handleError(error as Error);
    }
  }

  /**
   * Decode market state from account info
   */
  private decodeMarketState(result: AccountChangeResult): MarketState | null {
    try {
      const { account_id, account_info } = result;
      const marketAddress = new PublicKey(account_id);
      const data = Buffer.from(account_info.data);

      // Decode the market state layout
      const marketState = MARKET_STATE_LAYOUT_V3.decode(data);

      // Extract relevant fields based on actual raydium-sdk layout
      const market: MarketState = {
        address: marketAddress,
        baseMint: marketState.baseMint,
        quoteMint: marketState.quoteMint,
        bids: marketState.bids,
        asks: marketState.asks,
        eventQueue: marketState.eventQueue,
        baseVault: marketState.baseVault,
        quoteVault: marketState.quoteVault,
        baseLotSize: BigInt(marketState.baseLotSize.toString()),
        quoteLotSize: BigInt(marketState.quoteLotSize.toString()),
        feeRateBps: marketState.feeRateBps,
        // Set default values for optional fields that may not be in the layout
        flags: 0,
        exists: true,
      };

      return market;
    } catch (error) {
      console.error('Failed to decode market state:', error);
      return null;
    }
  }

  /**
   * Check if market passes additional filters
   */
  private passesFilters(market: MarketState): boolean {
    const { filters } = this.config;

    if (!filters) {
      return true;
    }

    // Filter by base mints if specified
    if (filters.baseMints && filters.baseMints.length > 0) {
      const baseMintAddress = market.baseMint.toBase58();
      const matches = filters.baseMints.some(mint => {
        const mintAddress = mint instanceof PublicKey ? mint : new PublicKey(mint);
        return mintAddress.toBase58() === baseMintAddress;
      });

      if (!matches) {
        return false;
      }
    }

    return true;
  }

  /**
   * Handle errors
   */
  private async handleError(error: Error): Promise<void> {
    if (this.config.onError) {
      await this.config.onError(error);
    } else {
      console.error('OpenBook client error:', error);
    }
  }

  /**
   * Stop monitoring for new markets
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring || this.subscriptionId === null) {
      return;
    }

    try {
      await this.connection.removeAccountChangeListener(this.subscriptionId);
    } catch (error) {
      console.error('Failed to remove account change listener:', error);
    }

    this.subscriptionId = null;
    this.isMonitoring = false;
  }

  /**
   * Check if currently monitoring
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get existing markets for a given quote mint
   */
  async getExistingMarkets(quoteMint?: PublicKey): Promise<MarketState[]> {
    const programId = this.config.programId!;
    const filters = [];

    // Filter by market state data size
    filters.push({
      dataSize: MARKET_STATE_LAYOUT_V3.span,
    });

    // Filter by quote mint if specified
    const targetQuoteMint = quoteMint || this.config.filters?.quoteMint;
    if (targetQuoteMint) {
      const quoteMintPubkey =
        targetQuoteMint instanceof PublicKey
          ? targetQuoteMint
          : new PublicKey(targetQuoteMint);

      const quoteMintOffset = MARKET_STATE_LAYOUT_V3.offsetOf('quoteMint');

      filters.push({
        memcmp: {
          offset: quoteMintOffset,
          bytes: quoteMintPubkey.toBase58(),
        },
      });
    }

    try {
      const accounts = await this.connection.getProgramAccounts(programId, {
        filters,
        commitment: this.config.filters?.commitment || 'confirmed',
      });

      const markets: MarketState[] = [];

      for (const account of accounts) {
        const result: AccountChangeResult = {
          account_id: account.pubkey.toBase58(),
          account_info: account.account,
          context: { slot: 0 },
        };

        const market = this.decodeMarketState(result);
        if (market && this.passesFilters(market)) {
          markets.push(market);
        }
      }

      return markets;
    } catch (error) {
      await this.handleError(error as Error);
      return [];
    }
  }
}

/**
 * Create an OpenBookClient instance
 */
export function createOpenBookClient(config: OpenBookClientConfig): OpenBookClient {
  return new OpenBookClient(config);
}

/**
 * Get default quote mint addresses
 */
export function getDefaultQuoteMints() {
  return DEFAULT_QUOTE_MINTS;
}

/**
 * Get OpenBook program IDs
 */
export function getOpenBookProgramIds() {
  return OPENBOOK_PROGRAM_IDS;
}
