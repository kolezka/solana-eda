import { PublicKey } from '@solana/web3.js';
import type { AccountInfo } from '@solana/web3.js';

/**
 * Supported DEX types for pool parsing
 */
export enum DEXType {
  ORCA = 'ORCA',
  RAYDIUM = 'RAYDIUM',
  METEORA = 'METEORA',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Token metadata for display
 */
export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

/**
 * Parsed pool data with all relevant information
 */
export interface ParsedPoolData {
  address: string;
  dexType: DEXType;
  tokenA: TokenMetadata;
  tokenB: TokenMetadata;
  reserveA: bigint;
  reserveB: bigint;
  tvl: number;
  price: number;
  lpSupply: bigint;
  feeRate: number;
}

/**
 * Pool state change for tracking
 */
export interface PoolStateChange {
  address: string;
  dexType: DEXType;
  oldTvl: number;
  newTvl: number;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  priceChangePercent: number;
  timestamp: number;
}

/**
 * Common Solana Token Program IDs
 */
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

/**
 * DEX Program IDs
 */
const ORCA_WHIRLPOOL_PROGRAM_ID = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');
const ORCA_CONCENTRATED_LIQUID_PROGRAM_ID = new PublicKey(
  'camC3CCK9LiVwcfkBgKBfcX2GLjJaEW3hFRyWrJVKCK',
);
const RAYDIUM_LIQUIDITY_POOL_V4_PROGRAM_ID = new PublicKey(
  '9qvG1zUp8xF1Bi4m6VdJeG4dSfJZJJnkC3bceCXdRHg',
);
const RAYDIUM_AMM_PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
const METEORA_DLMM_PROGRAM_ID = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKwgUurB1XTidjLGcnVxYg');
const METEORA_STABLE_SWAP_PROGRAM_ID = new PublicKey('EppX3fRUMvDqtuCZjkeH3C1dj1GhVNgXVHBRpJbzVXS');

/**
 * Common token mint addresses with metadata
 */
const TOKEN_METADATA: Record<string, TokenMetadata> = {
  So11111111111111111111111111111111111111112: {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Wrapped SOL',
    decimals: 9,
    logoURI:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
  },
};

/**
 * Parser for Solana DEX pool accounts
 * Supports Orca, Raydium, and Meteora pools
 */
export class PoolParser {
  /**
   * Detect DEX type from account owner
   */
  detectDEXType(owner: PublicKey): DEXType {
    const ownerStr = owner.toString();

    if (
      ownerStr === ORCA_WHIRLPOOL_PROGRAM_ID.toString() ||
      ownerStr === ORCA_CONCENTRATED_LIQUID_PROGRAM_ID.toString()
    ) {
      return DEXType.ORCA;
    }
    if (
      ownerStr === RAYDIUM_LIQUIDITY_POOL_V4_PROGRAM_ID.toString() ||
      ownerStr === RAYDIUM_AMM_PROGRAM_ID.toString()
    ) {
      return DEXType.RAYDIUM;
    }
    if (
      ownerStr === METEORA_DLMM_PROGRAM_ID.toString() ||
      ownerStr === METEORA_STABLE_SWAP_PROGRAM_ID.toString()
    ) {
      return DEXType.METEORA;
    }

    return DEXType.UNKNOWN;
  }

  /**
   * Parse pool account data based on DEX type
   */
  parsePool(accountAddress: PublicKey, accountInfo: AccountInfo<Buffer>): ParsedPoolData | null {
    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    const dexType = this.detectDEXType(accountInfo.owner);

    switch (dexType) {
      case DEXType.ORCA:
        return this.parseOrcaPool(accountAddress, accountInfo);
      case DEXType.RAYDIUM:
        return this.parseRaydiumPool(accountAddress, accountInfo);
      case DEXType.METEORA:
        return this.parseMeteoraPool(accountAddress, accountInfo);
      default:
        console.warn(`[PoolParser] Unknown DEX type for pool ${accountAddress.toString()}`);
        return null;
    }
  }

  /**
   * Parse Orca Whirlpool account data
   * Layout: https://github.com/orca-so/typescript-sdk/blob/master/src/plugins/whirlpool/whirlpool.ts
   */
  private parseOrcaPool(
    poolAddress: PublicKey,
    accountInfo: AccountInfo<Buffer>,
  ): ParsedPoolData | null {
    try {
      const data = accountInfo.data;

      // Orca Whirlpool layout (simplified)
      // Discriminator: 8 bytes
      // whirlpools_config: 32 bytes
      // whirlpool_bump: 1 byte
      // tick_spacing: 2 bytes
      // tick_current_index: 4 bytes (i32)
      // sqrt_price: 16 bytes (u128)
      // liquidity: 16 bytes (u128)
      // tick_prev_bitmap: 32 bytes * 16 = 512 bytes
      // fee_rate: 2 bytes (u16)
      // protocol_fee_rate: 2 bytes (u16)
      // token_a: 32 bytes
      // token_b: 32 bytes
      // token_vault_a: 32 bytes
      // token_vault_b: 32 bytes
      // fee_growth_global_a: 16 bytes (u128)
      // fee_growth_global_b: 16 bytes (u128)
      // reward_last_updated_timestamp: 8 bytes (u64)
      // reward_infos: 32 bytes * 3 = 96 bytes

      const DISCRIMINATOR_OFFSET = 0;
      const TOKEN_A_OFFSET = 748;
      const TOKEN_B_OFFSET = 780;
      const FEE_RATE_OFFSET = 700;
      const SQRT_PRICE_OFFSET = 81;
      const LIQUIDITY_OFFSET = 97;

      // Extract token mints
      const tokenAAddress = new PublicKey(
        data.slice(TOKEN_A_OFFSET, TOKEN_A_OFFSET + 32),
      ).toString();
      const tokenBAddress = new PublicKey(
        data.slice(TOKEN_B_OFFSET, TOKEN_B_OFFSET + 32),
      ).toString();

      // Get token metadata
      const tokenA = this.getTokenMetadata(tokenAAddress);
      const tokenB = this.getTokenMetadata(tokenBAddress);

      // Parse sqrt price (u128 little-endian)
      const sqrtPriceBytes = data.slice(SQRT_PRICE_OFFSET, SQRT_PRICE_OFFSET + 16);
      const sqrtPrice = this.readU128(sqrtPriceBytes);

      // Parse liquidity (u128 little-endian)
      const liquidityBytes = data.slice(LIQUIDITY_OFFSET, LIQUIDITY_OFFSET + 16);
      const liquidity = this.readU128(liquidityBytes);

      // Parse fee rate (u16)
      const feeRateBytes = data.slice(FEE_RATE_OFFSET, FEE_RATE_OFFSET + 2);
      const feeRate = ((feeRateBytes[0] ?? 0) | ((feeRateBytes[1] ?? 0) << 8)) / 10000; // Convert basis points to decimal

      // Calculate price from sqrt price
      // price = (sqrtPrice / 2^64)^2
      const sqrtPriceFloat = Number(sqrtPrice) / Math.pow(2, 64);
      const price = sqrtPriceFloat * sqrtPriceFloat;

      // Adjust for token decimals
      const adjustedPrice = price * Math.pow(10, tokenA.decimals - tokenB.decimals);

      // Calculate TVL (simplified - would need vault balances for accurate TVL)
      const tvl = (Number(liquidity) / Math.pow(2, 64)) * 2 * Math.sqrt(adjustedPrice);

      return {
        address: poolAddress.toString(),
        dexType: DEXType.ORCA,
        tokenA,
        tokenB,
        reserveA: liquidity, // Simplified
        reserveB: liquidity,
        tvl,
        price: adjustedPrice,
        lpSupply: liquidity,
        feeRate,
      };
    } catch (error) {
      console.error(`[PoolParser] Error parsing Orca pool:`, error);
      return null;
    }
  }

  /**
   * Parse Raydium Liquidity Pool V4 account data
   * Layout: https://github.com/raydium-io/raydium-sdk/blob/master/src/lp/amm.ts
   */
  private parseRaydiumPool(
    poolAddress: PublicKey,
    accountInfo: AccountInfo<Buffer>,
  ): ParsedPoolData | null {
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
      // min_price_multiplier: 1 byte
      // max_price_multiplier: 1 byte
      // system_decimal_value: 1 byte
      // min_separate_numerator: 1 byte
      // min_separate_denominator: 1 byte
      // trade_fee_numerator: 1 byte
      // trade_fee_denominator: 1 byte
      // pnl_numerator: 1 byte
      // pnl_denominator: 1 byte
      // swap_fee_numerator: 1 byte
      // swap_fee_denominator: 1 byte
      // base_need_take_pnl: 1 byte
      // quote_need_take_pnl: 1 byte
      // quote_total.pnl: 8 bytes
      // base_total.pnl: 8 bytes
      // pool_open_time: 8 bytes
      // pubkey: 32 bytes (swap)
      // pubkey: 32 bytes (pool_mint)
      // base_vault: 32 bytes
      // quote_vault: 32 bytes
      // base_mint: 32 bytes
      // quote_mint: 32 bytes
      // lp_mint: 32 bytes
      // model_data: variable

      const BASE_MINT_OFFSET = 237;
      const QUOTE_MINT_OFFSET = 269;
      const SWAP_FEE_NUMERATOR_OFFSET = 45;
      const SWAP_FEE_DENOMINATOR_OFFSET = 46;
      const BASE_VAULT_OFFSET = 173;
      const QUOTE_VAULT_OFFSET = 205;

      // Extract token mints
      const baseMint = new PublicKey(
        data.slice(BASE_MINT_OFFSET, BASE_MINT_OFFSET + 32),
      ).toString();
      const quoteMint = new PublicKey(
        data.slice(QUOTE_MINT_OFFSET, QUOTE_MINT_OFFSET + 32),
      ).toString();

      const tokenA = this.getTokenMetadata(baseMint);
      const tokenB = this.getTokenMetadata(quoteMint);

      // Parse fee rate
      const feeNumerator = data[SWAP_FEE_NUMERATOR_OFFSET] ?? 0;
      const feeDenominator = data[SWAP_FEE_DENOMINATOR_OFFSET] ?? 1;
      const feeRate = feeDenominator > 0 ? feeNumerator / feeDenominator : 0;

      // In production, you would fetch vault balances to calculate reserves
      // For now, return simplified data
      return {
        address: poolAddress.toString(),
        dexType: DEXType.RAYDIUM,
        tokenA,
        tokenB,
        reserveA: BigInt(0),
        reserveB: BigInt(0),
        tvl: 0,
        price: 0,
        lpSupply: BigInt(0),
        feeRate,
      };
    } catch (error) {
      console.error(`[PoolParser] Error parsing Raydium pool:`, error);
      return null;
    }
  }

  /**
   * Parse Meteora DLMM pool account data
   */
  private parseMeteoraPool(
    poolAddress: PublicKey,
    accountInfo: AccountInfo<Buffer>,
  ): ParsedPoolData | null {
    try {
      const data = accountInfo.data;

      // Meteora DLMM has a different structure
      // This is a simplified parser - actual implementation would need the full account layout

      const BIN_ARRAY_BITMAP_SIZE = 512;
      const TOKEN_A_OFFSET = 8 + BIN_ARRAY_BITMAP_SIZE + 8; // After discriminator and bitmap
      const TOKEN_B_OFFSET = TOKEN_A_OFFSET + 32;
      const FEE_RATE_OFFSET = TOKEN_B_OFFSET + 32;

      // Extract token mints
      const tokenAAddress = new PublicKey(
        data.slice(TOKEN_A_OFFSET, TOKEN_A_OFFSET + 32),
      ).toString();
      const tokenBAddress = new PublicKey(
        data.slice(TOKEN_B_OFFSET, TOKEN_B_OFFSET + 32),
      ).toString();

      const tokenA = this.getTokenMetadata(tokenAAddress);
      const tokenB = this.getTokenMetadata(tokenBAddress);

      // Parse fee rate if available
      const feeRate = 0.0025; // Default 0.25%

      return {
        address: poolAddress.toString(),
        dexType: DEXType.METEORA,
        tokenA,
        tokenB,
        reserveA: BigInt(0),
        reserveB: BigInt(0),
        tvl: 0,
        price: 0,
        lpSupply: BigInt(0),
        feeRate,
      };
    } catch (error) {
      console.error(`[PoolParser] Error parsing Meteora pool:`, error);
      return null;
    }
  }

  /**
   * Get token metadata from known tokens
   * In production, this would query the Metaplex Metadata program
   */
  private getTokenMetadata(mintAddress: string): TokenMetadata {
    if (TOKEN_METADATA[mintAddress]) {
      return TOKEN_METADATA[mintAddress];
    }

    // Return basic metadata for unknown tokens
    return {
      address: mintAddress,
      symbol: mintAddress.slice(0, 4) + '...',
      name: `Token ${mintAddress.slice(0, 8)}`,
      decimals: 9, // Default to 9 decimals (Solana standard)
    };
  }

  /**
   * Read u128 from buffer (little-endian)
   */
  private readU128(buffer: Buffer): bigint {
    let result = BigInt(0);
    for (let i = 0; i < 16; i++) {
      result += BigInt(buffer[i] ?? 0) << BigInt(8 * i);
    }
    return result;
  }

  /**
   * Calculate pool state change percentage
   */
  calculatePoolChange(oldData: ParsedPoolData, newData: ParsedPoolData): PoolStateChange {
    const tvlChangePercent =
      oldData.tvl > 0 ? ((newData.tvl - oldData.tvl) / oldData.tvl) * 100 : 0;

    const priceChangePercent =
      oldData.price > 0 ? ((newData.price - oldData.price) / oldData.price) * 100 : 0;

    return {
      address: newData.address,
      dexType: newData.dexType,
      oldTvl: oldData.tvl,
      newTvl: newData.tvl,
      oldPrice: oldData.price,
      newPrice: newData.price,
      changePercent: tvlChangePercent,
      priceChangePercent: priceChangePercent,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if pool change is significant
   */
  isSignificantChange(change: PoolStateChange, thresholdPercent: number = 5): boolean {
    return Math.abs(change.changePercent) >= thresholdPercent;
  }

  /**
   * Get token price in USD from reserves
   */
  calculateTokenPrice(
    reserveA: bigint,
    reserveB: bigint,
    decimalsA: number,
    decimalsB: number,
  ): number {
    const adjustedReserveA = Number(reserveA) / Math.pow(10, decimalsA);
    const adjustedReserveB = Number(reserveB) / Math.pow(10, decimalsB);

    if (adjustedReserveA === 0) return 0;

    return adjustedReserveB / adjustedReserveA;
  }

  /**
   * Calculate TVL from reserves and token prices
   */
  async calculateTVL(
    reserveA: bigint,
    reserveB: bigint,
    decimalsA: number,
    decimalsB: number,
    priceA: number = 0,
    priceB: number = 0,
  ): Promise<number> {
    const adjustedReserveA = Number(reserveA) / Math.pow(10, decimalsA);
    const adjustedReserveB = Number(reserveB) / Math.pow(10, decimalsB);

    // If one token is a stablecoin, use it as price reference
    if (priceA > 0 && priceB > 0) {
      return adjustedReserveA * priceA + adjustedReserveB * priceB;
    }

    // Otherwise, return token A amount in token B units
    return adjustedReserveA + adjustedReserveB;
  }
}

/**
 * Singleton instance for convenience
 */
export const poolParser = new PoolParser();
