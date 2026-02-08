// Jest globals are available globally in the test environment
// No need to import them explicitly
import { SolanaConnectionManager } from '@solana-eda/solana-client';
import { TransactionParser } from '@solana-eda/solana-client';
import { PublicKey } from '@solana/web3.js';

describe('Solana Client', () => {
  describe('SolanaConnectionManager', () => {
    let connection: SolanaConnectionManager;

    beforeEach(() => {
      connection = new SolanaConnectionManager(
        'https://api.devnet.solana.com',
        'wss://api.devnet.solana.com'
      );
    });

    afterEach(async () => {
      await connection.close();
    });

    it('should create connection instance', () => {
      expect(connection).toBeDefined();
      expect(connection.getConnection()).toBeDefined();
    });

    it('should get WebSocket connection', () => {
      const wsConn = connection.getWsConnection();
      expect(wsConn).toBeDefined();
    });
  });

  describe('TransactionParser', () => {
    let parser: TransactionParser;

    beforeEach(() => {
      parser = new TransactionParser();
    });

    it('should be instantiated', () => {
      expect(parser).toBeDefined();
    });

    it('should identify burn instruction data', () => {
      // Burn instruction type is 8
      const burnData = '08' + '00000000'.repeat(8); // 8 + 32 bytes
      const isBurn = (parser as any).isBurnInstruction(burnData);
      expect(isBurn).toBe(true);
    });

    it('should reject non-burn instruction', () => {
      const nonBurnData = '00' + '00000000'.repeat(8); // Not burn (type 0)
      const isBurn = (parser as any).isBurnInstruction(nonBurnData);
      expect(isBurn).toBe(false);
    });
  });
});
