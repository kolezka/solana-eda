import { Connection, PublicKey, TransactionInstruction, Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * Priority Fee Manager
 * Calculates and manages priority fees for Solana transactions
 * Critical for mainnet trading during network congestion
 */
export class PriorityFeeManager {
  private readonly COMPUTE_BUDGET_PROGRAM_ID = new PublicKey(
    'ComputeBudget111111111111111111111111111111',
  );

  /**
   * Calculate appropriate priority fee based on recent network activity
   * Uses median of recent fees with 20% buffer for reliability
   */
  async getPriorityFee(
    connection: Connection,
    accounts?: string[],
  ): Promise<number> {
    try {
      // Get recent prioritization fees from the network
      // Note: accounts parameter filtering is not fully supported in current web3.js version
      const fees = await connection.getRecentPrioritizationFees(undefined);

      // Filter for valid fees and sort
      const validFees = fees.filter((f) => f.prioritizationFee > 0);
      if (validFees.length === 0) {
        // No recent fees, return conservative default
        return 1000; // 0.000001 SOL minimum
      }

      // Sort fees to find median
      const sortedFees = validFees
        .map((f) => f.prioritizationFee)
        .sort((a, b) => a - b);

      // Calculate median fee
      const medianFee = sortedFees[Math.floor(sortedFees.length / 2)];

      if (!medianFee) {
        return 1000; // Fallback if median is undefined
      }

      // Add 20% buffer for priority during congestion
      const feeWithBuffer = Math.ceil(medianFee * 1.2);

      console.log(
        `[PriorityFeeManager] Calculated fee: ${feeWithBuffer} lamports (median: ${medianFee}, samples: ${validFees.length})`,
      );

      return feeWithBuffer;
    } catch (error) {
      console.error('[PriorityFeeManager] Error calculating fee:', error);
      // Return safe default on error
      return 5000; // 0.000005 SOL conservative default
    }
  }

  /**
   * Add ComputeBudgetInstruction to set compute unit price
   * This increases the priority fee for transaction processing
   */
  async setComputeUnitPrice(
    transaction: Transaction | VersionedTransaction,
    microLamports: number,
  ): Promise<Transaction | VersionedTransaction> {
    const data = Buffer.from([3, ...this.toBigIntLE(BigInt(microLamports))]);
    const ix = new TransactionInstruction({
      programId: this.COMPUTE_BUDGET_PROGRAM_ID,
      data,
      keys: [],
    });

    if (transaction instanceof VersionedTransaction) {
      // For VersionedTransaction, we need to add to the message
      // This is a simplified approach - in production you'd want to modify the transaction properly
      console.warn('[PriorityFeeManager] VersionedTransaction modification not fully implemented');
      return transaction;
    } else {
      transaction.add(ix);
      return transaction;
    }
  }

  /**
   * Add ComputeBudgetInstruction to set compute unit limit
   * This increases the compute budget for the transaction
   */
  async setComputeUnitLimit(
    transaction: Transaction | VersionedTransaction,
    units: number,
  ): Promise<Transaction | VersionedTransaction> {
    const data = Buffer.from([2, ...this.toBigIntLE(BigInt(units))]);
    const ix = new TransactionInstruction({
      programId: this.COMPUTE_BUDGET_PROGRAM_ID,
      data,
      keys: [],
    });

    if (transaction instanceof VersionedTransaction) {
      // For VersionedTransaction, we need to add to the message
      // This is a simplified approach - in production you'd want to modify the transaction properly
      console.warn('[PriorityFeeManager] VersionedTransaction modification not fully implemented');
      return transaction;
    } else {
      transaction.add(ix);
      return transaction;
    }
  }

  /**
   * Add both compute unit price and limit to a transaction
   * Convenience method for setting both priority fee and compute budget
   */
  async setComputeBudget(
    transaction: Transaction | VersionedTransaction,
    microLamports: number,
    units: number,
  ): Promise<Transaction | VersionedTransaction> {
    let tx = transaction;
    tx = await this.setComputeUnitPrice(tx, microLamports);
    tx = await this.setComputeUnitLimit(tx, units);
    return tx;
  }

  /**
   * Convert bigint to little-endian uint8 array
   * Required for ComputeBudgetInstruction encoding
   */
  private toBigIntLE(value: bigint): Uint8Array {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigUint64(0, value, true); // Little-endian
    return new Uint8Array(buffer);
  }

  /**
   * Estimate compute units for a DEX swap
   * Provides default CU estimates for different DEX types
   */
  estimateComputeUnitsForSwap(dexType: string): number {
    const estimates: Record<string, number> = {
      jupiter: 200_000,
      orca: 150_000,
      raydium: 150_000,
      meteora: 180_000,
      phoenix: 80_000, // CLOB typically requires fewer CUs
      openbook: 100_000, // CLOB typically requires fewer CUs
    };

    return estimates[dexType] || 200_000; // Default conservative estimate
  }

  /**
   * Calculate priority fee based on transaction complexity
   * Adjusts fee based on compute units and network conditions
   */
  async calculateFeeForTransaction(
    connection: Connection,
    computeUnits: number,
    accounts?: (PublicKey | string)[],
  ): Promise<{ priorityFee: number; computeUnits: number }> {
    // Convert accounts to strings if needed
    const accountStrings = accounts?.map(a => typeof a === 'string' ? a : a.toBase58());
    // Get base priority fee from network
    const priorityFee = await this.getPriorityFee(connection, accountStrings);

    // Calculate appropriate fee based on compute units
    // More complex transactions need higher fees
    const complexityMultiplier = Math.max(1, computeUnits / 200_000);
    const adjustedFee = Math.ceil(priorityFee * complexityMultiplier);

    return {
      priorityFee: adjustedFee,
      computeUnits,
    };
  }
}
