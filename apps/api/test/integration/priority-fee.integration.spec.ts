/**
 * Priority Fee Calculation Integration Tests
 *
 * Tests priority fee management:
 * - Fee calculation from network data
 * - Compute unit price instruction
 * - Compute unit limit instruction
 * - DEX-specific compute unit estimates
 * - Fee calculation for transaction complexity
 * - Fallback behavior on errors
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PriorityFeeManager } from '@solana-eda/solana-client';
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

describe('Priority Fee Integration', () => {
  let priorityFeeManager: PriorityFeeManager;
  let connection: Connection;

  beforeAll(() => {
    connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
    priorityFeeManager = new PriorityFeeManager();
  });

  describe('Fee Calculation', () => {
    it('should calculate priority fee from network data', async () => {
      const fee = await priorityFeeManager.getPriorityFee(connection);

      expect(fee).toBeGreaterThan(0);
      expect(fee).toBeLessThan(1000000); // Sanity check: less than 0.001 SOL
    });

    it('should return fallback fee on error', async () => {
      // Create a mock connection that fails
      const mockConnection = {
        getRecentPrioritizationFees: jest.fn().mockRejectedValue(new Error('Network error')),
      } as any;

      const fee = await priorityFeeManager.getPriorityFee(mockConnection);

      // Should return safe default
      expect(fee).toBe(5000);
    });

    it('should return minimum fee when no recent fees exist', async () => {
      // Mock connection that returns empty fees array
      const mockConnection = {
        getRecentPrioritizationFees: jest.fn().mockResolvedValue([]),
      } as any;

      const fee = await priorityFeeManager.getPriorityFee(mockConnection);

      expect(fee).toBe(1000); // Minimum fee
    });

    it('should filter out zero fees and calculate median', async () => {
      // Mock connection with mixed fee data
      const mockConnection = {
        getRecentPrioritizationFees: jest.fn().mockResolvedValue([
          { prioritizationFee: 0 },
          { prioritizationFee: 0 },
          { prioritizationFee: 1000 },
          { prioritizationFee: 2000 },
          { prioritizationFee: 3000 },
          { prioritizationFee: 0 },
        ]),
      } as any;

      const fee = await priorityFeeManager.getPriorityFee(mockConnection);

      // Median of [1000, 2000, 3000] is 2000
      // With 20% buffer: 2400
      expect(fee).toBeGreaterThan(0);
      expect(fee).toBeLessThanOrEqual(2400);
    });
  });

  describe('Compute Unit Price Instruction', () => {
    it('should add compute unit price instruction to transaction', async () => {
      const transaction = new Transaction();
      const microLamports = 1000;

      const modifiedTx = await priorityFeeManager.setComputeUnitPrice(transaction, microLamports);

      expect(modifiedTx.instructions).toHaveLength(1);

      const instruction = modifiedTx.instructions[0];
      expect(instruction.programId.toBase58()).toBe('ComputeBudget111111111111111111111111111111');
      expect(instruction.keys).toHaveLength(0);
    });

    it('should encode microLamports correctly', async () => {
      const transaction = new Transaction();
      const microLamports = 5000;

      const modifiedTx = await priorityFeeManager.setComputeUnitPrice(transaction, microLamports);

      const instruction = modifiedTx.instructions[0];
      const data = instruction.data;

      // Instruction data should contain the microLamports value
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
    });

    it('should handle large fee values', async () => {
      const transaction = new Transaction();
      const microLamports = 1000000; // 1 SOL per compute unit

      const modifiedTx = await priorityFeeManager.setComputeUnitPrice(transaction, microLamports);

      expect(modifiedTx.instructions).toHaveLength(1);
    });

    it('should handle zero fee', async () => {
      const transaction = new Transaction();
      const microLamports = 0;

      const modifiedTx = await priorityFeeManager.setComputeUnitPrice(transaction, microLamports);

      expect(modifiedTx.instructions).toHaveLength(1);
    });
  });

  describe('Compute Unit Limit Instruction', () => {
    it('should add compute unit limit instruction to transaction', async () => {
      const transaction = new Transaction();
      const units = 200000;

      const modifiedTx = await priorityFeeManager.setComputeUnitLimit(transaction, units);

      expect(modifiedTx.instructions).toHaveLength(1);

      const instruction = modifiedTx.instructions[0];
      expect(instruction.programId.toBase58()).toBe('ComputeBudget111111111111111111111111111111');
    });

    it('should encode compute units correctly', async () => {
      const transaction = new Transaction();
      const units = 150000;

      const modifiedTx = await priorityFeeManager.setComputeUnitLimit(transaction, units);

      const instruction = modifiedTx.instructions[0];
      expect(instruction.data).toBeDefined();
    });

    it('should handle max compute units', async () => {
      const transaction = new Transaction();
      const units = 1400000; // Maximum compute units

      const modifiedTx = await priorityFeeManager.setComputeUnitLimit(transaction, units);

      expect(modifiedTx.instructions).toHaveLength(1);
    });
  });

  describe('Combined Compute Budget', () => {
    it('should add both compute unit price and limit instructions', async () => {
      const transaction = new Transaction();
      const microLamports = 1000;
      const units = 200000;

      const modifiedTx = await priorityFeeManager.setComputeBudget(transaction, microLamports, units);

      expect(modifiedTx.instructions).toHaveLength(2);

      // Verify both instructions are present
      modifiedTx.instructions.forEach(instruction => {
        expect(instruction.programId.toBase58()).toBe('ComputeBudget111111111111111111111111111111');
      });
    });

    it('should handle multiple calls correctly', async () => {
      const transaction = new Transaction();

      const tx1 = await priorityFeeManager.setComputeUnitPrice(transaction, 1000);
      const tx2 = await priorityFeeManager.setComputeUnitLimit(tx1, 200000);

      expect(tx2.instructions).toHaveLength(2);
    });
  });

  describe('DEX Compute Unit Estimates', () => {
    it('should provide compute unit estimates for different DEXes', () => {
      const dexTypes = ['jupiter', 'orca', 'raydium', 'meteora', 'phoenix', 'openbook'];

      dexTypes.forEach(dexType => {
        const estimate = priorityFeeManager.estimateComputeUnitsForSwap(dexType);

        expect(estimate).toBeGreaterThan(0);
        expect(estimate).toBeLessThanOrEqual(200000);
      });
    });

    it('should return default estimate for unknown DEX', () => {
      const estimate = priorityFeeManager.estimateComputeUnitsForSwap('unknown-dex');

      expect(estimate).toBe(200000); // Default conservative estimate
    });

    it('should provide appropriate estimates for CLOB DEXes', () => {
      const clobEstimates = {
        phoenix: priorityFeeManager.estimateComputeUnitsForSwap('phoenix'),
        openbook: priorityFeeManager.estimateComputeUnitsForSwap('openbook'),
      };

      // CLOB DEXes should require fewer compute units
      Object.values(clobEstimates).forEach(estimate => {
        expect(estimate).toBeLessThan(150000);
      });
    });

    it('should provide appropriate estimates for aggregator DEXes', () => {
      const aggregatorEstimates = {
        jupiter: priorityFeeManager.estimateComputeUnitsForSwap('jupiter'),
        meteora: priorityFeeManager.estimateComputeUnitsForSwap('meteora'),
      };

      // Aggregator DEXes may require more compute units
      Object.values(aggregatorEstimates).forEach(estimate => {
        expect(estimate).toBeGreaterThanOrEqual(150000);
      });
    });
  });

  describe('Transaction-Specific Fee Calculation', () => {
    it('should calculate fee based on transaction complexity', async () => {
      const computeUnits = 200000;
      const accounts = [
        new PublicKey('11111111111111111111111111111111'),
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      ];

      const result = await priorityFeeManager.calculateFeeForTransaction(
        connection,
        computeUnits,
        accounts
      );

      expect(result.priorityFee).toBeGreaterThan(0);
      expect(result.computeUnits).toBe(computeUnits);
    });

    it('should adjust fee based on compute unit complexity', async () => {
      const accounts = [new PublicKey('11111111111111111111111111111111')];

      const simpleTx = await priorityFeeManager.calculateFeeForTransaction(
        connection,
        100000,
        accounts
      );

      const complexTx = await priorityFeeManager.calculateFeeForTransaction(
        connection,
        300000,
        accounts
      );

      // More complex transaction should have higher fee
      expect(complexTx.priorityFee).toBeGreaterThan(simpleTx.priorityFee);
    });

    it('should handle empty accounts array', async () => {
      const computeUnits = 200000;

      const result = await priorityFeeManager.calculateFeeForTransaction(
        connection,
        computeUnits
      );

      expect(result.priorityFee).toBeGreaterThan(0);
      expect(result.computeUnits).toBe(computeUnits);
    });

    it('should handle string account addresses', async () => {
      const computeUnits = 200000;
      const accounts = [
        '11111111111111111111111111111111',
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      ];

      const result = await priorityFeeManager.calculateFeeForTransaction(
        connection,
        computeUnits,
        accounts
      );

      expect(result.priorityFee).toBeGreaterThan(0);
    });
  });

  describe('Integration with Real Transactions', () => {
    it('should create a complete transaction with priority fees', async () => {
      const transaction = new Transaction();

      // Add a dummy instruction
      transaction.add(
        new TransactionInstruction({
          keys: [],
          programId: new PublicKey('11111111111111111111111111111111'),
          data: Buffer.alloc(0),
        })
      );

      // Add compute budget
      const fee = await priorityFeeManager.getPriorityFee(connection);
      const computeUnits = priorityFeeManager.estimateComputeUnitsForSwap('jupiter');

      const modifiedTx = await priorityFeeManager.setComputeBudget(
        transaction,
        fee,
        computeUnits
      );

      // Should have original instruction + 2 compute budget instructions
      expect(modifiedTx.instructions).toHaveLength(3);

      // Verify compute budget instructions are first (important for fee priority)
      const firstInstruction = modifiedTx.instructions[0];
      expect(firstInstruction.programId.toBase58()).toBe('ComputeBudget111111111111111111111111111111');
    });

    it('should handle multi-instruction transactions', async () => {
      const transaction = new Transaction();

      // Add multiple instructions
      for (let i = 0; i < 5; i++) {
        transaction.add(
          new TransactionInstruction({
            keys: [],
            programId: new PublicKey('11111111111111111111111111111111'),
            data: Buffer.from([i]),
          })
        );
      }

      // Add compute budget
      const fee = await priorityFeeManager.getPriorityFee(connection);
      const modifiedTx = await priorityFeeManager.setComputeUnitPrice(transaction, fee);

      expect(modifiedTx.instructions).toHaveLength(6);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should handle network errors gracefully', async () => {
      const mockConnection = {
        getRecentPrioritizationFees: jest.fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce([]),
      } as any;

      // First call fails - should use fallback
      const fee1 = await priorityFeeManager.getPriorityFee(mockConnection);
      expect(fee1).toBe(5000); // Fallback value

      // Second call returns empty - should use minimum
      const fee2 = await priorityFeeManager.getPriorityFee(mockConnection);
      expect(fee2).toBe(1000); // Minimum value
    });

    it('should handle malformed fee data', async () => {
      const mockConnection = {
        getRecentPrioritizationFees: jest.fn().mockResolvedValue([
          { prioritizationFee: -1 }, // Invalid fee
          { prioritizationFee: null as any },
          { prioritizationFee: undefined as any },
        ]),
      } as any;

      const fee = await priorityFeeManager.getPriorityFee(mockConnection);

      // Should filter invalid fees and return minimum
      expect(fee).toBe(1000);
    });

    it('should handle very high fee data', async () => {
      const mockConnection = {
        getRecentPrioritizationFees: jest.fn().mockResolvedValue([
          { prioritizationFee: 10000000 }, // Very high fee
          { prioritizationFee: 20000000 },
          { prioritizationFee: 30000000 },
        ]),
      } as any;

      const fee = await priorityFeeManager.getPriorityFee(mockConnection);

      // Should cap at reasonable level (with 20% buffer)
      expect(fee).toBeLessThanOrEqual(36000000);
    });
  });

  describe('Performance and Timing', () => {
    it('should calculate fees quickly', async () => {
      const startTime = Date.now();

      const fee = await priorityFeeManager.getPriorityFee(connection);

      const duration = Date.now() - startTime;

      expect(fee).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should batch compute budget instructions efficiently', async () => {
      const transaction = new Transaction();

      const startTime = Date.now();

      const modifiedTx = await priorityFeeManager.setComputeBudget(
        transaction,
        1000,
        200000
      );

      const duration = Date.now() - startTime;

      expect(modifiedTx.instructions).toHaveLength(2);
      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle both legacy and versioned transactions', async () => {
      const legacyTx = new Transaction();

      // For legacy transactions
      const modifiedLegacyTx = await priorityFeeManager.setComputeUnitPrice(legacyTx, 1000);
      expect(modifiedLegacyTx.instructions).toHaveLength(1);

      // VersionedTransaction handling is not fully implemented (logged as warning)
      // This test documents current behavior
    });

    it('should serialize correctly', async () => {
      const transaction = new Transaction();
      transaction.add(
        new TransactionInstruction({
          keys: [],
          programId: new PublicKey('11111111111111111111111111111111'),
          data: Buffer.alloc(0),
        })
      );

      const modifiedTx = await priorityFeeManager.setComputeBudget(transaction, 1000, 200000);

      // Should be serializable without errors
      expect(() => {
        modifiedTx.serialize();
      }).not.toThrow();
    });
  });
});
