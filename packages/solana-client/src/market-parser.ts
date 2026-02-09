import { PublicKey } from '@solana/web3.js';
import type { AccountInfo } from '@solana/web3.js';

/**
 * Supported DEX types for market parsing
 */
export enum MarketDEXType {
  OPENBOOK = 'OPENBOOK',
  RAYDIUM = 'RAYDIUM',
  ORCA = 'ORCA',
  METEORA = 'METEORA',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Parsed market data
 */
export interface ParsedMarketData {
  address: string;
  dexType: MarketDEXType;
  baseMint: string;
  quoteMint: string;
  marketData?: {
    name?: string;
    minOrderSize?: string;
    tickSize?: string;
    lotSize?: string;
    baseDecimals?: number;
    quoteDecimals?: number;
  };
}

/**
 * Token metadata
 */
export interface MarketTokenMetadata {
  address: string;
  symbol: string;
  decimals: number;
}

/**
 * DEX Program IDs
 */
export const OPENBOOK_V2_PROGRAM_ID = new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX');
export const OPENBOOK_V1_PROGRAM_ID = new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
export const RAYDIUM_AMM_PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
export const RAYDIUM_LIQUIDITY_POOL_V4_PROGRAM_ID = new PublicKey('9qvG1zUp8xF1Bi4m6VdJeG4dSfJZJJnkC3bceCXdRHg');
export const ORCA_WHIRLPOOL_PROGRAM_ID = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');
export const METEORA_DLMM_PROGRAM_ID = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKwgUurB1XTidjLGcnVxYg');

/**
 * Common token mint addresses
 */
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

/**
 * Parser for Solana DEX market accounts
 * Supports OpenBook, Raydium, Orca, and Meteora markets
 */
export class MarketParser {
  /**
   * Detect DEX type from account owner
   */
  detectMarketDEXType(owner: PublicKey): MarketDEXType {
    const ownerStr = owner.toString();

    if (ownerStr === OPENBOOK_V2_PROGRAM_ID.toString() || ownerStr === OPENBOOK_V1_PROGRAM_ID.toString()) {
      return MarketDEXType.OPENBOOK;
    }
    if (ownerStr === RAYDIUM_AMM_PROGRAM_ID.toString() || ownerStr === RAYDIUM_LIQUIDITY_POOL_V4_PROGRAM_ID.toString()) {
      return MarketDEXType.RAYDIUM;
    }
    if (ownerStr === ORCA_WHIRLPOOL_PROGRAM_ID.toString()) {
      return MarketDEXType.ORCA;
    }
    if (ownerStr === METEORA_DLMM_PROGRAM_ID.toString()) {
      return MarketDEXType.METEORA;
    }

    return MarketDEXType.UNKNOWN;
  }

  /**
   * Parse market account data based on DEX type
   */
  parseMarket(accountAddress: PublicKey, accountInfo: AccountInfo<Buffer>): ParsedMarketData | null {
    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    const dexType = this.detectMarketDEXType(accountInfo.owner);

    switch (dexType) {
      case MarketDEXType.OPENBOOK:
        return this.parseOpenBookMarket(accountAddress, accountInfo);
      case MarketDEXType.RAYDIUM:
        return this.parseRaydiumMarket(accountAddress, accountInfo);
      case MarketDEXType.ORCA:
        return this.parseOrcaMarket(accountAddress, accountInfo);
      case MarketDEXType.METEORA:
        return this.parseMeteoraMarket(accountAddress, accountInfo);
      default:
        console.warn(`[MarketParser] Unknown DEX type for market ${accountAddress.toString()}`);
        return null;
    }
  }

  /**
   * Parse OpenBook V2/V1 market account data
   * Layout reference: https://github.com/openbook-dex/program/
   */
  private parseOpenBookMarket(
    marketAddress: PublicKey,
    accountInfo: AccountInfo<Buffer>,
  ): ParsedMarketData | null {
    try {
      const data = accountInfo.data;

      // OpenBook Market State Layout V3
      // discriminator: 8 bytes
      // market_admin: 32 bytes
      // funding_pool_address: 32 bytes
      // base_mint: 32 bytes (offset: 72)
      // quote_mint: 32 bytes (offset: 104)
      // base_vault: 32 bytes
      // quote_vault: 32 bytes
      // bids: 32 bytes
      // asks: 32 bytes
      // event_queue: 32 bytes
      // base_decimals: 1 byte (offset: 328)
      // quote_decimals: 1 byte (offset: 329)
      // ... more fields

      const BASE_MINT_OFFSET = 72;
      const QUOTE_MINT_OFFSET = 104;
      const BASE_DECIMALS_OFFSET = 328;
      const QUOTE_DECIMALS_OFFSET = 329;

      // Extract token mints
      const baseMint = new PublicKey(
        data.slice(BASE_MINT_OFFSET, BASE_MINT_OFFSET + 32),
      ).toString();
      const quoteMint = new PublicKey(
        data.slice(QUOTE_MINT_OFFSET, QUOTE_MINT_OFFSET + 32),
      ).toString();

      // Extract decimals
      const baseDecimals = data[BASE_DECIMALS_OFFSET] ?? 9;
      const quoteDecimals = data[QUOTE_DECIMALS_OFFSET] ?? 6;

      return {
        address: marketAddress.toString(),
        dexType: MarketDEXType.OPENBOOK,
        baseMint,
        quoteMint,
        marketData: {
          baseDecimals,
          quoteDecimals,
        },
      };
    } catch (error) {
      console.error(`[MarketParser] Error parsing OpenBook market:`, error);
      return null;
    }
  }

  /**
   * Parse Raydium AMM market/pool account data
   */
  private parseRaydiumMarket(
    marketAddress: PublicKey,
    accountInfo: AccountInfo<Buffer>,
  ): ParsedMarketData | null {
    try {
      const data = accountInfo.data;

      // Raydium AMM layout (simplified)
      // status: 1 byte
      // nonce: 1 byte
      // max_order_count: 1 byte
      // depth: 1 byte
      // base_decimal: 1 byte
      // quote_decimal: 1 byte
      // state: 1 byte
      // reset_flag: 1 byte
      // min_size: 8 bytes
      // vol_max_cut_ratio: 1 byte
      // amount_wave_ratio: 1 byte
      // base_lot_size: 8 bytes
      // quote_lot_size: 8 bytes
      // ... more fields
      // base_mint: 32 bytes (offset: 237)
      // quote_mint: 32 bytes (offset: 269)

      const BASE_MINT_OFFSET = 237;
      const QUOTE_MINT_OFFSET = 269;
      const BASE_DECIMAL_OFFSET = 4;
      const QUOTE_DECIMAL_OFFSET = 5;

      // Extract token mints
      const baseMint = new PublicKey(
        data.slice(BASE_MINT_OFFSET, BASE_MINT_OFFSET + 32),
      ).toString();
      const quoteMint = new PublicKey(
        data.slice(QUOTE_MINT_OFFSET, QUOTE_MINT_OFFSET + 32),
      ).toString();

      // Extract decimals
      const baseDecimals = data[BASE_DECIMAL_OFFSET] ?? 9;
      const quoteDecimals = data[QUOTE_DECIMAL_OFFSET] ?? 6;

      return {
        address: marketAddress.toString(),
        dexType: MarketDEXType.RAYDIUM,
        baseMint,
        quoteMint,
        marketData: {
          baseDecimals,
          quoteDecimals,
        },
      };
    } catch (error) {
      console.error(`[MarketParser] Error parsing Raydium market:`, error);
      return null;
    }
  }

  /**
   * Parse Orca Whirlpool market/pool account data
   */
  private parseOrcaMarket(
    marketAddress: PublicKey,
    accountInfo: AccountInfo<Buffer>,
  ): ParsedMarketData | null {
    try {
      const data = accountInfo.data;

      // Orca Whirlpool layout (simplified)
      // See pool-parser.ts for detailed layout
      const TOKEN_A_OFFSET = 748;
      const TOKEN_B_OFFSET = 780;

      // Extract token mints
      const tokenAAddress = new PublicKey(
        data.slice(TOKEN_A_OFFSET, TOKEN_A_OFFSET + 32),
      ).toString();
      const tokenBAddress = new PublicKey(
        data.slice(TOKEN_B_OFFSET, TOKEN_B_OFFSET + 32),
      ).toString();

      return {
        address: marketAddress.toString(),
        dexType: MarketDEXType.ORCA,
        baseMint: tokenAAddress,
        quoteMint: tokenBAddress,
      };
    } catch (error) {
      console.error(`[MarketParser] Error parsing Orca market:`, error);
      return null;
    }
  }

  /**
   * Parse Meteora DLMM market/pool account data
   */
  private parseMeteoraMarket(
    marketAddress: PublicKey,
    accountInfo: AccountInfo<Buffer>,
  ): ParsedMarketData | null {
    try {
      const data = accountInfo.data;

      // Meteora DLMM layout (simplified)
      const BIN_ARRAY_BITMAP_SIZE = 512;
      const TOKEN_A_OFFSET = 8 + BIN_ARRAY_BITMAP_SIZE + 8;
      const TOKEN_B_OFFSET = TOKEN_A_OFFSET + 32;

      // Extract token mints
      const tokenAAddress = new PublicKey(
        data.slice(TOKEN_A_OFFSET, TOKEN_A_OFFSET + 32),
      ).toString();
      const tokenBAddress = new PublicKey(
        data.slice(TOKEN_B_OFFSET, TOKEN_B_OFFSET + 32),
      ).toString();

      return {
        address: marketAddress.toString(),
        dexType: MarketDEXType.METEORA,
        baseMint: tokenAAddress,
        quoteMint: tokenBAddress,
      };
    } catch (error) {
      console.error(`[MarketParser] Error parsing Meteora market:`, error);
      return null;
    }
  }

  /**
   * Check if a quote mint is a known stablecoin or SOL
   */
  isKnownQuoteMint(mint: string): boolean {
    return [WSOL_MINT, USDC_MINT, USDT_MINT].includes(mint);
  }

  /**
   * Get token metadata for known tokens
   */
  getTokenMetadata(mint: string): MarketTokenMetadata {
    switch (mint) {
      case WSOL_MINT:
        return { address: WSOL_MINT, symbol: 'SOL', decimals: 9 };
      case USDC_MINT:
        return { address: USDC_MINT, symbol: 'USDC', decimals: 6 };
      case USDT_MINT:
        return { address: USDT_MINT, symbol: 'USDT', decimals: 6 };
      default:
        return { address: mint, symbol: mint.slice(0, 4), decimals: 9 };
    }
  }

  /**
   * Validate market data structure
   */
  isValidMarket(market: ParsedMarketData): boolean {
    return (
      market.address !== '' &&
      market.baseMint !== '' &&
      market.quoteMint !== '' &&
      market.dexType !== MarketDEXType.UNKNOWN
    );
  }
}

/**
 * Singleton instance for convenience
 */
export const marketParser = new MarketParser();
