import { PublicKey, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';

export interface ParsedBurnTransaction {
  signature: string;
  token: string;
  amount: string;
  burner: string;
  preSupply: string;
  postSupply: string;
  decimals: number;
  timestamp: string;
  blockTime?: number;
}

export interface TokenBalanceChange {
  address: string;
  preBalance: bigint;
  postBalance: bigint;
  change: bigint;
}

export interface BurnInstructionData {
  amount: bigint;
  decimals: number;
  authority: string;
  tokenAccount: string;
  tokenMint: string;
}

export class TransactionParser {
  private readonly SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
  private readonly TOKEN_PROGRAM_ID = new PublicKey(
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
  );
  private readonly TOKEN_2022_PROGRAM_ID = new PublicKey(
    'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
  );

  // Token Program instruction types
  private readonly TOKEN_INSTRUCTIONS = {
    INITIALIZE_MINT: 0,
    INITIALIZE_ACCOUNT: 1,
    INITIALIZE_MULTISIG: 2,
    TRANSFER: 3,
    APPROVE: 4,
    REVOKE: 5,
    SET_AUTHORITY: 6,
    MINT_TO: 7,
    BURN: 8,
    CLOSE_ACCOUNT: 9,
    FREEZE_ACCOUNT: 10,
    THAW_ACCOUNT: 11,
    TRANSFER2: 12,
    APPROVE2: 13,
    REVOKE2: 14,
    FREEZE_ACCOUNT2: 15,
    THAW_ACCOUNT2: 16,
    MINT_TO2: 17,
    BURN2: 18,
    ACCOUNT_EQUIVALENCE: 19,
    SYNC_NATIVE: 20,
  };

  /**
   * Check if transaction contains a burn instruction
   */
  isBurnTransaction(transaction: Transaction | any): boolean {
    if (!transaction.message || !transaction.message.instructions) {
      return false;
    }

    return transaction.message.instructions.some((instruction: any) => {
      const programId = typeof instruction.programId === 'string'
        ? instruction.programId
        : instruction.programId?.toString?.();

      return (
        (programId === this.TOKEN_PROGRAM_ID.toString() ||
         programId === this.TOKEN_2022_PROGRAM_ID.toString()) &&
        this.isBurnInstruction(instruction)
      );
    });
  }

  /**
   * Check if instruction is a burn instruction
   */
  private isBurnInstruction(instruction: any): boolean {
    if (instruction.parsed?.type === 'burn' || instruction.parsed?.type === 'burnChecked') {
      return true;
    }

    if (!instruction.data || instruction.data.length < 4) return false;

    try {
      // For raw instruction data, first byte is instruction type
      const instructionType = Buffer.from(instruction.data, 'base64')[0];

      return instructionType === this.TOKEN_INSTRUCTIONS.BURN ||
             instructionType === this.TOKEN_INSTRUCTIONS.BURN2;
    } catch {
      return false;
    }
  }

  /**
   * Parse burn transaction with enhanced data extraction
   */
  parseBurnTransaction(transaction: any, signature: string): ParsedBurnTransaction | null {
    if (!this.isBurnTransaction(transaction)) {
      return null;
    }

    try {
      // Try to use parsed instruction first (more reliable)
      const parsedBurn = this.parseParsedBurnInstruction(transaction, signature);
      if (parsedBurn) {
        return parsedBurn;
      }

      // Fall back to raw instruction parsing
      return this.parseRawBurnInstruction(transaction, signature);
    } catch (error) {
      console.error('[TransactionParser] Error parsing burn transaction:', error);
      return null;
    }
  }

  /**
   * Parse from parsed transaction (preferred method)
   */
  private parseParsedBurnInstruction(transaction: any, signature: string): ParsedBurnTransaction | null {
    try {
      const instructions = transaction.transaction?.message?.instructions ||
                          transaction.message?.instructions;

      if (!instructions) return null;

      // Find burn instruction
      const burnInstruction = instructions.find((inst: any) => {
        return inst.parsed?.type === 'burn' ||
               inst.parsed?.type === 'burnChecked';
      });

      if (!burnInstruction?.parsed) return null;

      const info = burnInstruction.parsed.info;

      // Extract burn data
      const amount = info.amount || info.tokenAmount?.amount || '0';
      const burner = info.authority || info.owner;
      const tokenMint = info.mint;
      const decimals = info.tokenAmount?.decimals || 0;

      // Get balance changes from meta
      const balanceChanges = this.extractBalanceChanges(transaction);

      // Calculate supply change
      let preSupply = '0';
      let postSupply = '0';

      // Look for mint account balance changes
      for (const change of balanceChanges) {
        if (change.address === tokenMint) {
          preSupply = change.preBalance.toString();
          postSupply = change.postBalance.toString();
          break;
        }
      }

      return {
        signature,
        token: tokenMint,
        amount,
        burner,
        preSupply,
        postSupply,
        decimals,
        timestamp: transaction.blockTime
          ? new Date(transaction.blockTime * 1000).toISOString()
          : new Date().toISOString(),
        blockTime: transaction.blockTime,
      };
    } catch (error) {
      console.error('[TransactionParser] Error parsing burn instruction:', error);
      return null;
    }
  }

  /**
   * Parse from raw instruction data (fallback method)
   */
  private parseRawBurnInstruction(transaction: any, signature: string): ParsedBurnTransaction | null {
    try {
      const instructions = transaction.message?.instructions;
      if (!instructions) return null;

      const burnInst = instructions.find((inst: any) => {
        const programId = typeof inst.programId === 'string'
          ? inst.programId
          : inst.programId?.toString?.();

        return (programId === this.TOKEN_PROGRAM_ID.toString() ||
                programId === this.TOKEN_2022_PROGRAM_ID.toString()) &&
               this.isBurnInstruction(inst);
      });

      if (!burnInst) return null;

      const accountKeys = transaction.message.accountKeys;
      const data = burnInst.data || '';

      // Decode instruction data
      const dataBuffer = Buffer.from(data, 'base64');
      const instructionType = dataBuffer[0];

      if (instructionType !== this.TOKEN_INSTRUCTIONS.BURN &&
          instructionType !== this.TOKEN_INSTRUCTIONS.BURN2) {
        return null;
      }

      // Parse burn amount (u64, bytes 1-8)
      const amountBytes = dataBuffer.slice(1, 9);
      const amount = this.readU64(amountBytes);

      // Account structure varies between Burn and BurnChecked
      // Burn: [source_account, authority, ...]
      // BurnChecked: [source_account, authority, token_amount_owner, ...]
      const tokenAccountIndex = burnInst.accounts[0];
      const authorityIndex = burnInst.accounts[1];

      const tokenMint = accountKeys[tokenAccountIndex] || 'unknown';
      const burner = accountKeys[authorityIndex] || 'unknown';

      // Get balance changes
      const balanceChanges = this.extractBalanceChanges(transaction);
      let preSupply = '0';
      let postSupply = '0';

      for (const change of balanceChanges) {
        if (change.address === tokenMint) {
          preSupply = change.preBalance.toString();
          postSupply = change.postBalance.toString();
          break;
        }
      }

      return {
        signature,
        token: tokenMint,
        amount: amount.toString(),
        burner,
        preSupply,
        postSupply,
        decimals: 0, // Not available in raw format
        timestamp: transaction.blockTime
          ? new Date(transaction.blockTime * 1000).toISOString()
          : new Date().toISOString(),
        blockTime: transaction.blockTime,
      };
    } catch (error) {
      console.error('[TransactionParser] Error parsing raw burn instruction:', error);
      return null;
    }
  }

  /**
   * Extract balance changes from transaction metadata
   */
  private extractBalanceChanges(transaction: any): TokenBalanceChange[] {
    const changes: TokenBalanceChange[] = [];

    try {
      const accountKeys = transaction.message.accountKeys;
      const preBalances = transaction.meta?.preBalances || [];
      const postBalances = transaction.meta?.postBalances || [];
      const preTokenBalances = transaction.meta?.preTokenBalances || [];
      const postTokenBalances = transaction.meta?.postTokenBalances || [];

      // Process SOL balance changes
      for (let i = 0; i < accountKeys.length; i++) {
        if (preBalances[i] !== undefined || postBalances[i] !== undefined) {
          const preBalance = BigInt(preBalances[i] || 0);
          const postBalance = BigInt(postBalances[i] || 0);

          if (preBalance !== postBalance) {
            changes.push({
              address: accountKeys[i],
              preBalance,
              postBalance,
              change: postBalance - preBalance,
            });
          }
        }
      }

      // Process token balance changes
      const tokenBalanceMap = new Map<string, { pre: bigint; post: bigint }>();

      for (const tb of preTokenBalances) {
        const mint = tb.mint;
        const amount = BigInt(tb.uiTokenAmount.amount || 0);
        tokenBalanceMap.set(mint, { pre: amount, post: BigInt(0) });
      }

      for (const tb of postTokenBalances) {
        const mint = tb.mint;
        const amount = BigInt(tb.uiTokenAmount.amount || 0);
        const existing = tokenBalanceMap.get(mint);
        if (existing) {
          existing.post = amount;
        } else {
          tokenBalanceMap.set(mint, { pre: BigInt(0), post: amount });
        }
      }

      for (const [mint, balances] of tokenBalanceMap.entries()) {
        if (balances.pre !== balances.post) {
          changes.push({
            address: mint,
            preBalance: balances.pre,
            postBalance: balances.post,
            change: balances.post - balances.pre,
          });
        }
      }
    } catch (error) {
      console.error('[TransactionParser] Error extracting balance changes:', error);
    }

    return changes;
  }

  /**
   * Calculate burn percentage from supply
   */
  calculateBurnPercentage(burnTx: ParsedBurnTransaction): number {
    try {
      const preSupply = BigInt(burnTx.preSupply);
      const burnAmount = BigInt(burnTx.amount);

      if (preSupply === BigInt(0)) return 0;

      return Number((burnAmount * BigInt(10000)) / preSupply) / 100; // Return as percentage with 2 decimals
    } catch {
      return 0;
    }
  }

  /**
   * Check if burn meets minimum threshold
   */
  meetsMinimumThreshold(burnTx: ParsedBurnTransaction, minAmount: number): boolean {
    try {
      const burnAmount = BigInt(burnTx.amount);
      return burnAmount >= BigInt(minAmount);
    } catch {
      return false;
    }
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

  /**
   * Check if transaction is a SOL transfer
   */
  isSolTransferTransaction(transaction: any): boolean {
    if (!transaction.message || !transaction.message.instructions) {
      return false;
    }

    return transaction.message.instructions.some((instruction: any) => {
      return (
        instruction.programId === this.SYSTEM_PROGRAM_ID.toString() &&
        instruction.parsed?.type === 'transfer'
      );
    });
  }

  /**
   * Parse SOL transfer transaction
   */
  parseSolTransfer(transaction: any, signature: string) {
    if (!this.isSolTransferTransaction(transaction)) {
      return null;
    }

    try {
      const instruction = transaction.message.instructions.find(
        (inst: any) =>
          inst.programId === this.SYSTEM_PROGRAM_ID.toString() &&
          inst.parsed?.type === 'transfer'
      );

      if (!instruction) return null;

      return {
        signature,
        from: instruction.parsed.info.source,
        to: instruction.parsed.info.destination,
        amount: instruction.parsed.info.lamports,
        timestamp: transaction.blockTime
          ? new Date(transaction.blockTime * 1000).toISOString()
          : new Date().toISOString(),
      };
    } catch (error) {
      console.error('[TransactionParser] Error parsing transfer:', error);
      return null;
    }
  }

  /**
   * Get token metadata from transaction
   */
  getTokenMetadata(transaction: any, mintAddress: string): any {
    try {
      const tokenBalances = transaction.meta?.postTokenBalances || [];
      const tokenBalance = tokenBalances.find((tb: any) => tb.mint === mintAddress);

      if (tokenBalance) {
        return {
          decimals: tokenBalance.uiTokenAmount.decimals,
          symbol: tokenBalance.uiTokenAmount.symbol,
        };
      }

      return null;
    } catch {
      return null;
    }
  }
}
