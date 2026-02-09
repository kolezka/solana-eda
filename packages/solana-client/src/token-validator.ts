import { PublicKey } from '@solana/web3.js';
import type { AccountInfo } from '@solana/web3.js';

/**
 * Token validation result
 */
export interface TokenValidationResult {
  token: string;
  isRenounced: boolean;
  isBurned: boolean;
  isLocked: boolean;
  lpBurnedCount: number;
  confidence: number;
  validationDetails: {
    mintAuthorityRenounced: boolean;
    supplyBurned: boolean;
    supplyBurnedPercent?: number;
    lpTokensBurned: boolean;
    liquidityLocked: boolean;
  };
}

/**
 * Mint account data structure
 */
export interface MintAccountData {
  mintAuthorityOption: number;
  mintAuthority: string | null;
  supply: string;
  decimals: number;
  freezeAuthorityOption: number;
  freezeAuthority: string | null;
}

/**
 * Token Program IDs
 */
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

/**
 * Validator for Solana tokens
 * Handles mint authority checks, supply burns, LP token burns, and liquidity locks
 */
export class TokenValidator {
  /**
   * Validate a token mint account
   */
  async validateToken(
    tokenMint: string,
    mintAccountInfo: AccountInfo<Buffer>,
    lpMintAccountInfo?: AccountInfo<Buffer>,
    lpReserve?: bigint,
  ): Promise<TokenValidationResult> {
    // Parse mint account data
    const mintData = this.parseMintAccount(tokenMint, mintAccountInfo);

    // Check if mint authority is renounced
    const isRenounced = this.checkMintable(mintData);

    // Check if supply is burned
    const supplyCheck = this.checkSupplyBurned(mintData);

    // Check LP tokens burned (if LP mint provided)
    let lpBurnedCount = 0;
    let lpTokensBurned = false;
    if (lpMintAccountInfo && lpReserve !== undefined) {
      const lpBurnCheck = this.checkLpBurned(lpMintAccountInfo, lpReserve);
      lpBurnedCount = lpBurnCheck.burnedCount;
      lpTokensBurned = lpBurnCheck.isBurned;
    }

    // Check liquidity lock (simplified - would need pool state)
    const isLocked = false; // Would need pool state to check

    // Calculate confidence score
    const confidence = this.calculateConfidence(
      isRenounced,
      supplyCheck.isBurned,
      lpTokensBurned,
      isLocked,
    );

    return {
      token: tokenMint,
      isRenounced,
      isBurned: supplyCheck.isBurned,
      isLocked,
      lpBurnedCount,
      confidence,
      validationDetails: {
        mintAuthorityRenounced: isRenounced,
        supplyBurned: supplyCheck.isBurned,
        supplyBurnedPercent: supplyCheck.burnedPercent,
        lpTokensBurned,
        liquidityLocked: isLocked,
      },
    };
  }

  /**
   * Parse mint account data from buffer
   */
  parseMintAccount(mintAddress: string, accountInfo: AccountInfo<Buffer>): MintAccountData {
    try {
      const data = accountInfo.data;

      // Mint account layout (Token Program)
      // mint_authority_option: 1 byte (offset: 0)
      // mint_authority: 32 bytes (offset: 1, if option is 1)
      // supply: 8 bytes (u64)
      // decimals: 1 byte
      // freeze_authority_option: 1 byte
      // freeze_authority: 32 bytes (if option is 1)

      const MINT_AUTHORITY_OPTION_OFFSET = 0;
      const MINT_AUTHORITY_OFFSET = 1;
      const SUPPLY_OFFSET = 33;
      const DECIMALS_OFFSET = 41;
      const FREEZE_AUTHORITY_OPTION_OFFSET = 42;
      const FREEZE_AUTHORITY_OFFSET = 43;

      const mintAuthorityOption = data[MINT_AUTHORITY_OPTION_OFFSET] ?? 0;
      let mintAuthority: string | null = null;

      if (mintAuthorityOption === 1) {
        const authorityBytes = data.slice(MINT_AUTHORITY_OFFSET, MINT_AUTHORITY_OFFSET + 32);
        mintAuthority = new PublicKey(authorityBytes).toString();
      }

      const supply = this.readU64(data.slice(SUPPLY_OFFSET, SUPPLY_OFFSET + 8));
      const decimals = data[DECIMALS_OFFSET] ?? 0;
      const freezeAuthorityOption = data[FREEZE_AUTHORITY_OPTION_OFFSET] ?? 0;
      let freezeAuthority: string | null = null;

      if (freezeAuthorityOption === 1) {
        const freezeBytes = data.slice(FREEZE_AUTHORITY_OFFSET, FREEZE_AUTHORITY_OFFSET + 32);
        freezeAuthority = new PublicKey(freezeBytes).toString();
      }

      return {
        mintAuthorityOption,
        mintAuthority,
        supply: supply.toString(),
        decimals,
        freezeAuthorityOption,
        freezeAuthority,
      };
    } catch (error) {
      console.error(`[TokenValidator] Error parsing mint account ${mintAddress}:`, error);
      throw error;
    }
  }

  /**
   * Check if token is renounced (mint authority disabled)
   * Port of LiquidityValidator.checkMintable() from sniper bot
   */
  checkMintable(mintData: MintAccountData): boolean {
    // Token is renounced if mintAuthorityOption === 0 (no authority) or mintAuthority === null
    return mintData.mintAuthorityOption === 0 || mintData.mintAuthority === null;
  }

  /**
   * Check if supply is burned
   */
  checkSupplyBurned(mintData: MintAccountData): { isBurned: boolean; burnedPercent?: number } {
    const supply = BigInt(mintData.supply);

    // Consider burned if supply is less than a threshold
    // This is a simplified check - in production, you'd compare to initial supply
    const isBurned = supply < BigInt(1000); // Less than 1000 tokens = burned

    let burnedPercent: number | undefined;
    if (isBurned) {
      // Calculate burned percentage (would need initial supply for accurate calculation)
      burnedPercent = 99.99; // Placeholder
    }

    return { isBurned, burnedPercent };
  }

  /**
   * Check if LP tokens are burned
   * Port of LiquidityValidator.getBurnedCount() from sniper bot
   */
  checkLpBurned(
    lpMintAccountInfo: AccountInfo<Buffer>,
    lpReserve: bigint,
  ): { burnedCount: number; isBurned: boolean } {
    try {
      const lpMintData = this.parseMintAccount('lp-mint', lpMintAccountInfo);
      const supply = BigInt(lpMintData.supply);

      // Calculate burned LP tokens: supply - lpReserve = burned
      // lpReserve is the amount of LP tokens in the pool
      // If supply < lpReserve, some LP tokens have been burned
      const burned = supply < lpReserve ? lpReserve - supply : BigInt(0);

      const burnedCount = Number(burned);
      const isBurned = burned > BigInt(0);

      return { burnedCount, isBurned };
    } catch (error) {
      console.error('[TokenValidator] Error checking LP burn:', error);
      return { burnedCount: 0, isBurned: false };
    }
  }

  /**
   * Check if liquidity is locked
   * Port of LiquidityValidator.checkLocked() from sniper bot
   */
  checkLocked(poolAccountData: Buffer): boolean {
    try {
      // This would decode LIQUIDITY_STATE_LAYOUT_V4
      // and check the status field for lock status
      // Simplified implementation for now

      // In the sniper bot, this checks:
      // - state.status === 6 (withdrawOnly)
      // - state.orderbook_to_remove !== 0

      return false; // Placeholder
    } catch (error) {
      console.error('[TokenValidator] Error checking lock status:', error);
      return false;
    }
  }

  /**
   * Calculate confidence score for token validation
   * Public method for use by burn-detector worker
   */
  calculateConfidence(
    isRenounced: boolean,
    isBurned: boolean,
    lpTokensBurned: boolean,
    isLocked: boolean,
  ): number {
    let score = 0;

    // Each check contributes to confidence
    if (isRenounced) score += 0.3;
    if (isBurned) score += 0.2;
    if (lpTokensBurned) score += 0.3;
    if (isLocked) score += 0.2;

    return Math.min(score, 1.0);
  }

  /**
   * Validate multiple tokens in batch
   */
  async validateTokens(
    tokens: Array<{
      mint: string;
      mintAccount: AccountInfo<Buffer>;
      lpMintAccount?: AccountInfo<Buffer>;
      lpReserve?: bigint;
    }>,
  ): Promise<TokenValidationResult[]> {
    const results: TokenValidationResult[] = [];

    for (const token of tokens) {
      try {
        const result = await this.validateToken(
          token.mint,
          token.mintAccount,
          token.lpMintAccount,
          token.lpReserve,
        );
        results.push(result);
      } catch (error) {
        console.error(`[TokenValidator] Error validating token ${token.mint}:`, error);
        // Add failed validation result
        results.push({
          token: token.mint,
          isRenounced: false,
          isBurned: false,
          isLocked: false,
          lpBurnedCount: 0,
          confidence: 0,
          validationDetails: {
            mintAuthorityRenounced: false,
            supplyBurned: false,
            lpTokensBurned: false,
            liquidityLocked: false,
          },
        });
      }
    }

    return results;
  }

  /**
   * Read u64 from buffer (little-endian)
   */
  private readU64(buffer: Buffer): bigint {
    let result = BigInt(0);
    for (let i = 0; i < 8; i++) {
      const byte = buffer[i];
      if (byte !== undefined) {
        result += BigInt(byte) << BigInt(8 * i);
      }
    }
    return result;
  }
}

/**
 * Singleton instance for convenience
 */
export const tokenValidator = new TokenValidator();
