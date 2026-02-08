import { describe, it, expect } from '@jest/globals';
import {
  createBurnEvent,
  createLiquidityEvent,
  createTradeEvent,
  validateEvent,
  BurnEventSchema,
  isBurnEvent,
} from '@solana-eda/events';

describe('Events', () => {
  describe('createBurnEvent', () => {
    it('should create a valid burn event', () => {
      const eventData = {
        token: 'So11111111111111111111111111111111111111112',
        amount: '1000000',
        percentage: 0.05,
        txSignature: 'test-signature',
        burner: 'test-burner',
        preSupply: '10000000000',
        postSupply: '9999000000',
      };

      const event = createBurnEvent(eventData);

      expect(event.type).toBe('BURN_DETECTED');
      if (isBurnEvent(event)) {
        expect(event.data.token).toBe(eventData.token);
        expect(event.data.amount).toBe(eventData.amount);
      }
      expect(event.timestamp).toBeDefined();
      expect(event.id).toBeDefined();
    });
  });

  describe('validateEvent', () => {
    it('should validate a valid burn event', () => {
      const event = {
        type: 'BURN_DETECTED',
        timestamp: new Date().toISOString(),
        id: 'test-id',
        data: {
          token: 'So11111111111111111111111111111111111111112',
          amount: '1000000',
          percentage: 0.05,
          txSignature: 'test-signature',
          burner: 'test-burner',
          preSupply: '10000000000',
          postSupply: '9999000000',
        },
      };

      const result = validateEvent(event);
      expect(result).toEqual(event);
    });

    it('should throw on invalid event', () => {
      const invalidEvent = {
        type: 'INVALID_TYPE',
        timestamp: new Date().toISOString(),
        id: 'test-id',
        data: {},
      };

      expect(() => validateEvent(invalidEvent)).toThrow();
    });
  });
});
