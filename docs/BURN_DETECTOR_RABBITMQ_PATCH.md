# Burn Detector Worker - RabbitMQ Integration Patch

This file shows the exact changes needed to integrate RabbitMQ publishing into the burn-detector worker.

## Changes to workers/burn-detector/src/index.ts

### 1. Add imports after line 13

```typescript
import { RabbitMQConnection, initWorkerRabbitMQ, publishWorkerEvent, closeWorkerRabbitMQ } from '@solana-eda/rabbitmq/worker';
```

### 2. Add properties to BurnDetectorWorker class (after line 60)

```typescript
class BurnDetectorWorker {
  private connection: SolanaConnectionManager;
  private parser: TransactionParser;
  private tokenValidator: TokenValidator;
  private running = false;
  private workerName = 'burn-detector';
  private subscriptionId: number | null = null;
  private marketSubscriptionId: number | null = null;

  // NEW: RabbitMQ properties
  private rabbitMQConnection: RabbitMQConnection | null = null;
  private rabbitMQEnabled = false;
  private dualWriteEnabled = false;

  private metrics = {
    eventsProcessed: 0,
    errors: 0,
    burnsDetected: 0,
    duplicatesFiltered: 0,
    belowThresholdFiltered: 0,
    tokensValidated: 0,
    startTime: Date.now(),
    // NEW: RabbitMQ metrics
    rabbitMQPublishSuccess: 0,
    rabbitMQPublishFailure: 0,
  };
```

### 3. Add RabbitMQ initialization method (after constructor)

```typescript
  /**
   * Initialize RabbitMQ connection for event publishing
   */
  private async initializeRabbitMQ() {
    // Check feature flags
    this.rabbitMQEnabled = process.env.RABBITMQ_ENABLED === 'true';
    this.dualWriteEnabled = process.env.RABBITMQ_DUAL_WRITE === 'true';

    if (!this.rabbitMQEnabled) {
      console.log('[BurnDetector] RabbitMQ publishing disabled');
      return;
    }

    try {
      console.log('[BurnDetector] Initializing RabbitMQ connection...');
      this.rabbitMQConnection = await initWorkerRabbitMQ({
        url: process.env.RABBITMQ_URL || 'amqp://solana:solana123@localhost:5672',
        exchangeName: 'solana.events',
        enablePublisherConfirms: true,
      });
      console.log('[BurnDetector] RabbitMQ connection established');
    } catch (error) {
      console.error('[BurnDetector] Failed to connect to RabbitMQ:', error);
      this.rabbitMQEnabled = false;
      this.rabbitMQConnection = null;
    }
  }
```

### 4. Update start() method (add after line 83, before `this.running = true`)

```typescript
  async start() {
    console.log(`[BurnDetector] Starting worker...`);
    console.log(`[BurnDetector] Minimum burn threshold: ${MIN_BURN_THRESHOLD}`);
    console.log(`[BurnDetector] RPC URL: ${process.env.SOLANA_RPC_URL || 'mainnet'}`);

    // NEW: Initialize RabbitMQ
    await this.initializeRabbitMQ();

    this.running = true;
    // ... rest of method
  }
```

### 5. Update stop() method (add after `this.running = false`)

```typescript
  async stop() {
    console.log(`[BurnDetector] Stopping worker...`);
    this.running = false;

    // NEW: Close RabbitMQ connection
    if (this.rabbitMQConnection) {
      try {
        await closeWorkerRabbitMQ(this.rabbitMQConnection);
        console.log('[BurnDetector] RabbitMQ connection closed');
      } catch (error) {
        console.error('[BurnDetector] Error closing RabbitMQ:', error);
      }
      this.rabbitMQConnection = null;
    }

    // ... rest of method
  }
```

### 6. Update burn event publishing (replace line 443)

```typescript
      // Publish to Redis (always)
      await redis.publish(CHANNELS.EVENTS_BURN, JSON.stringify(event));

      // NEW: Also publish to RabbitMQ if enabled
      if (this.rabbitMQEnabled && this.rabbitMQConnection) {
        try {
          await publishWorkerEvent(
            this.rabbitMQConnection,
            'BURN_DETECTED',
            event.data,
            {
              routingKey: 'burn.detected',
              source: 'burn-detector',
              correlationId: event.id,
            }
          );
          this.metrics.rabbitMQPublishSuccess++;
        } catch (error) {
          console.error('[BurnDetector] RabbitMQ publish failed:', error);
          this.metrics.rabbitMQPublishFailure++;
          // Continue with Redis success
        }
      }

      this.metrics.burnsDetected++;
      this.metrics.eventsProcessed++;
```

### 7. Update token validated event publishing (replace line 319)

```typescript
      // Publish to Redis
      await redis.publish(CHANNELS.EVENTS_TOKENS, JSON.stringify(event));

      // NEW: Also publish to RabbitMQ if enabled
      if (this.rabbitMQEnabled && this.rabbitMQConnection) {
        try {
          await publishWorkerEvent(
            this.rabbitMQConnection,
            'TOKEN_VALIDATED',
            event.data,
            {
              routingKey: 'token.validated',
              source: 'burn-detector',
              correlationId: event.id,
            }
          );
          this.metrics.rabbitMQPublishSuccess++;
        } catch (error) {
          console.error('[BurnDetector] RabbitMQ publish failed:', error);
          this.metrics.rabbitMQPublishFailure++;
        }
      }
```

## Environment Variables for Docker Compose

Add to docker-compose.yml for each worker:

```yaml
workers:
  burn-detector:
    environment:
      RABBITMQ_URL: amqp://solana:solana123@rabbitmq:5672
      RABBITMQ_ENABLED: "false"
      RABBITMQ_DUAL_WRITE: "false"
```

## Testing the Integration

### 1. Test without RabbitMQ (default)
```bash
RABBITMQ_ENABLED=false pnpm burn-detector
```

### 2. Test RabbitMQ connection
```bash
RABBITMQ_ENABLED=true pnpm burn-detector
```

### 3. Test dual-write mode
```bash
RABBITMQ_ENABLED=true
RABBITMQ_DUAL_WRITE=true
pnpm burn-detector
```

### 4. Verify in RabbitMQ Management UI
- Navigate to http://localhost:15672
- Login with solana/solana123
- Check Exchanges tab for solana.events
- Check Queues tab for message rates
