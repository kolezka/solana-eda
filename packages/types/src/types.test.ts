import { describe, it, expect } from '@jest/globals';
import { EventType, AnyEvent } from '@solana-eda/types';

describe('Types', () => {
  describe('EventType', () => {
    it('should include all expected event types', () => {
      const types: EventType[] = [
        'BURN_DETECTED',
        'LIQUIDITY_CHANGED',
        'TRADE_EXECUTED',
        'POSITION_OPENED',
        'POSITION_CLOSED',
        'WORKER_STATUS',
        'DEX_QUOTE_COMPARISON',
      ];

      expect(types).toContain('BURN_DETECTED');
      expect(types).toContain('LIQUIDITY_CHANGED');
      expect(types).toContain('TRADE_EXECUTED');
      expect(types).toContain('POSITION_OPENED');
      expect(types).toContain('POSITION_CLOSED');
      expect(types).toContain('WORKER_STATUS');
      expect(types).toContain('DEX_QUOTE_COMPARISON');
    });
  });

  describe('StrategyConfig', () => {
    it('should allow valid strategy config', () => {
      const config = {
        enabled: true,
        maxSlippage: 0.03,
        maxPositions: 5,
        stopLossPercent: 0.10,
        takeProfitPercent: 0.50,
        minBurnAmount: 1000,
        maxPositionSize: 0.02,
      };

      expect(config.enabled).toBe(true);
      expect(config.maxSlippage).toBe(0.03);
      expect(config.maxPositions).toBe(5);
    });
  });

  describe('Position', () => {
    it('should allow valid position', () => {
      const position = {
        id: 'test-id',
        token: 'So11111111111111111111111111111111111112',
        amount: '1000000',
        entryPrice: '1.50',
        currentPrice: '1.60',
        pnl: '6.67',
        status: 'OPEN' as const,
        openedAt: new Date().toISOString(),
        stopLoss: '1.35',
        takeProfit: '2.25',
      };

      expect(position.status).toBe('OPEN');
      expect(position.token).toBeDefined();
      expect(position.amount).toBeDefined();
    });
  });

  describe('BurnDetectedEvent', () => {
    it('should have correct structure', () => {
      const event: AnyEvent = {
        type: 'BURN_DETECTED',
        timestamp: new Date().toISOString(),
        id: 'test-burn-event',
        data: {
          token: 'So11111111111111111111111111111111112',
          amount: '1000000',
          percentage: 0.05,
          txSignature: 'test-signature',
          burner: 'test-burner',
          preSupply: '10000000000',
          postSupply: '9999000000',
        },
      };

      expect(event.type).toBe('BURN_DETECTED');
      expect(event.data.token).toBeDefined();
      expect(event.data.amount).toBeDefined();
    });
  });

  describe('DEXQuoteComparisonEvent', () => {
    it('should have correct structure', () => {
      const event: AnyEvent = {
        type: 'DEX_QUOTE_COMPARISON',
        timestamp: new Date().toISOString(),
        id: 'test-dex-comparison',
        data: {
          inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          outputMint: 'So11111111111111111111111111111111112',
          amount: '1000000',
          quotes: [
            {
              dex: 'jupiter',
              outAmount: '990000',
              priceImpactPct: 0.01,
            },
            {
              dex: 'orca',
              outAmount: '995000',
              priceImpactPct: 0.008,
            },
            {
              dex: 'meteora',
              outAmount: '992000',
              priceImpactPct: 0.005,
            },
            {
              dex: 'raydium',
              outAmount: '993000',
              priceImpactPct: 0.006,
            },
          ],
          selectedDEX: 'orca',
          bestQuote: {
            dex: 'orca',
            outAmount: '995000',
            priceImpactPct: 0.008,
          },
        },
      };

      expect(event.type).toBe('DEX_QUOTE_COMPARISON');
      expect(event.data.inputMint).toBeDefined();
      expect(event.data.quotes).toBeDefined();
      expect(event.data.quotes.length).toBe(4);
      expect(event.data.selectedDEX).toBe('orca');
    });
  });
});
