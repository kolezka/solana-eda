# RabbitMQ Integration Guide for Workers

This guide explains how to integrate RabbitMQ publishing into the worker processes.

## Feature Flags

Add these environment variables to control RabbitMQ integration:

```bash
# Enable RabbitMQ publishing (default: false for migration)
RABBITMQ_ENABLED=false

# Enable dual-write mode (write to both Redis and RabbitMQ)
RABBITMQ_DUAL_WRITE=false

# RabbitMQ connection URL
RABBITMQ_URL=amqp://solana:solana123@localhost:5672
```

## Integration Pattern

### Step 1: Add RabbitMQ Connection to Worker

```typescript
import { RabbitMQConnection, publishWorkerEvent, initWorkerRabbitMQ, closeWorkerRabbitMQ } from '@solana-eda/rabbitmq/worker';

class BurnDetectorWorker {
  private rabbitMQConnection: RabbitMQConnection | null = null;
  private rabbitMQEnabled = false;

  async initializeRabbitMQ() {
    // Check feature flag
    this.rabbitMQEnabled = process.env.RABBITMQ_ENABLED === 'true';

    if (!this.rabbitMQEnabled) {
      console.log('[BurnDetector] RabbitMQ publishing disabled');
      return;
    }

    try {
      this.rabbitMQConnection = await initWorkerRabbitMQ({
        url: process.env.RABBITMQ_URL || 'amqp://solana:solana123@localhost:5672',
        exchangeName: 'solana.events',
        enablePublisherConfirms: true,
      });
      console.log('[BurnDetector] RabbitMQ connection established');
    } catch (error) {
      console.error('[BurnDetector] Failed to connect to RabbitMQ:', error);
      // Continue without RabbitMQ
      this.rabbitMQEnabled = false;
    }
  }
}
```

### Step 2: Update Event Publishing

Current (Redis only):
```typescript
await redis.publish(CHANNELS.EVENTS_BURN, JSON.stringify(event));
```

Updated (dual-write):
```typescript
// Always publish to Redis
await redis.publish(CHANNELS.EVENTS_BURN, JSON.stringify(event));

// Also publish to RabbitMQ if enabled
if (this.rabbitMQEnabled && this.rabbitMQConnection) {
  await publishWorkerEvent(
    this.rabbitMQConnection,
    'BURN_DETECTED',
    event.data,
    {
      routingKey: 'burn.detected',
      source: 'burn-detector',
      correlationId: event.id,
    }
  ).catch(error => {
    console.error('[BurnDetector] RabbitMQ publish failed:', error);
    // Don't fail the worker if RabbitMQ fails
  });
}
```

### Step 3: Add to start() method

```typescript
async start() {
  console.log(`[BurnDetector] Starting worker...`);

  // Initialize RabbitMQ
  await this.initializeRabbitMQ();

  this.running = true;
  // ... rest of start logic
}
```

### Step 4: Add to stop() method

```typescript
async stop() {
  console.log(`[BurnDetector] Stopping worker...`);

  this.running = false;

  // Close RabbitMQ connection
  if (this.rabbitMQConnection) {
    await closeWorkerRabbitMQ(this.rabbitMQConnection);
    this.rabbitMQConnection = null;
  }

  // ... rest of stop logic
}
```

## Migration Steps

### Phase 1: Add Code (No RabbitMQ Enabled)
1. Add RabbitMQ connection initialization
2. Add dual-write publishing code
3. Test with `RABBITMQ_ENABLED=false`

### Phase 2: Enable Dual-Write
1. Set `RABBITMQ_ENABLED=true`
2. Set `RABBITMQ_DUAL_WRITE=true`
3. Verify events appear in both Redis and RabbitMQ
4. Monitor for errors

### Phase 3: RabbitMQ Only
1. Set `RABBITMQ_DUAL_WRITE=false`
2. Verify all events go to RabbitMQ only
3. Keep Redis publishing as fallback

### Phase 4: Cleanup
1. Remove Redis publishing code
2. Remove `RabbitMQConnection` close
3. Remove from `package.json`

## Worker-Specific Routing Keys

| Worker | Event Type | Routing Key |
|--------|-----------|-------------|
| burn-detector | BURN_DETECTED | burn.detected |
| burn-detector | TOKEN_VALIDATED | token.validated |
| liquidity-monitor | LIQUIDITY_CHANGED | liquidity.changed |
| trading-bot | TRADE_EXECUTED | trade.executed |
| trading-bot | POSITION_OPENED | position.opened |
| trading-bot | POSITION_CLOSED | position.closed |
| price-aggregator | PRICE_UPDATE | price.updated |
| market-detector | MARKET_DISCOVERED | market.discovered |
| All workers | WORKER_STATUS | worker.{worker-name}.{status} |

## Error Handling

RabbitMQ publishing failures should not crash the worker:

```typescript
try {
  await publishWorkerEvent(...);
} catch (error) {
  console.error('[Worker] RabbitMQ publish failed:', error);
  // Continue with Redis publishing
  // Log metric for monitoring
}
```

## Monitoring

Add these metrics to track RabbitMQ adoption:

```typescript
metrics: {
  rabbitMQPublishSuccess: 0,
  rabbitMQPublishFailure: 0,
  rabbitMQEnabled: false,
}
```
