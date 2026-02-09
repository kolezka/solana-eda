# @solana-eda/rabbitmq

RabbitMQ integration package for Solana Event-Driven Architecture.

## Features

- **Connection Management**: Auto-reconnect with exponential backoff
- **Message Publishing**: Publisher confirms for guaranteed delivery
- **Message Consumption**: Manual ACK, prefetch control, error handling
- **Topology Management**: Exchanges, queues, bindings, and DLQ setup
- **Dead Letter Queues**: Failed message handling with retry analysis
- **Retry Policies**: Configurable retry strategies for different failure scenarios

## Installation

```bash
pnpm add @solana-eda/rabbitmq
```

## Quick Start

```typescript
import { createRabbitMQClient } from '@solana-eda/rabbitmq';

// Create and connect
const client = await createRabbitMQClient({
  url: 'amqp://user:password@localhost:5672',
  exchangeName: 'solana.events',
  enablePublisherConfirms: true,
  prefetchCount: 10,
}, 'my-worker-name');

// Publish events
await client.producer.publish('BURN_DETECTED', {
  token: 'Token...',
  amount: 1000000,
});

// Consume events
await client.consumer.consume({
  queueName: 'q.burn.events',
  handler: async (event, ack, nack) => {
    console.log('Received burn event:', event);
    await processEvent(event);
    ack();
  },
});
```

## Architecture

### Exchanges

- `solana.events` (topic): Main exchange for all events
- `solana.status` (fanout): Worker status updates
- `solana.dlq` (fanout): Dead letter queue

### Queues

- `q.burn.events`: Burn detected events
- `q.trade.events`: Trade execution events
- `q.price.events`: Price update events
- `q.liquidity.events`: Liquidity change events
- `q.positions`: Position lifecycle events
- `q.workers`: Worker status events
- `q.token.launch`: Token launch events
- `q.market.events`: Market events
- `q.arbitrage`: Arbitrage opportunities
- `q.system`: System events

### Event Envelope

All messages are wrapped in an event envelope:

```typescript
interface EventEnvelope {
  version: string;        // Schema version
  id: string;            // Unique event ID (UUID)
  correlationId?: string; // Correlation ID for tracing
  causationId?: string;   // Causation ID for event chains
  timestamp: string;      // ISO 8601 timestamp
  type: string;          // Event type
  routingKey: string;     // RabbitMQ routing key
  data: unknown;         // Event payload
  source?: string;        // Source service
}
```

## Configuration

```typescript
interface RabbitMQConfig {
  url: string;                           // amqp://user:pass@host:port
  exchangeName?: string;                 // Default: solana.events
  exchangeType?: 'topic' | 'fanout';     // Default: topic
  prefetchCount?: number;                // Default: 10
  reconnectDelay?: number;               // Default: 5000ms
  enablePublisherConfirms?: boolean;     // Default: false
  maxRetries?: number;                   // Default: 10
}
```

## Environment Variables

```bash
# RabbitMQ Configuration
RABBITMQ_URL=amqp://solana:solana123@localhost:5672
RABBITMQ_EXCHANGE=solana.events
RABBITMQ_EXCHANGE_TYPE=topic
RABBITMQ_PREFETCH_COUNT=10
RABBITMQ_RECONNECT_DELAY=5000

# Feature Flags (for migration)
RABBITMQ_ENABLED=false
RABBITMQ_DUAL_WRITE=false
RABBITMQ_DUAL_READ=false
```

## Usage Examples

### Publishing Events

```typescript
import { RabbitMQProducer } from '@solana-eda/rabbitmq';

const producer = new RabbitMQProducer(connection, 'solana.events', 'burn-detector');

// Simple publish
await producer.publish('BURN_DETECTED', {
  mint: 'So11111111111111111111111111111111111111112',
  amount: 1000000,
});

// Publish with custom routing key
await producer.publish('LIQUIDITY_CHANGED', data, {
  routingKey: 'liquidity.removed',
  priority: 5,
});

// Publish worker status
await producer.publishStatus('burn-detector', 'RUNNING', {
  subscriptions: 42,
  eventsProcessed: 1000,
});
```

### Consuming Events

```typescript
import { RabbitMQConsumer } from '@solana-eda/rabbitmq';

const consumer = new RabbitMQConsumer(connection, 10);

const consumerTag = await consumer.consume({
  queueName: 'q.burn.events',
  manualAck: true,
  handler: async (event, ack, nack) => {
    try {
      await processBurnEvent(event.data);
      ack();
    } catch (error) {
      // NACK with requeue for retry
      nack({ requeue: true });
    }
  },
});
```

### Dead Letter Queue Handling

```typescript
import { DLQHandler, createDLQHandler } from '@solana-eda/rabbitmq';

const dlqHandler = createDLQHandler(channel, 'q.burn.events', {
  maxRetryAttempts: 3,
  onMaxRetriesExceeded: async (message) => {
    console.error('Permanent failure:', message);
    // Alert, log to database, etc.
  },
});

await dlqHandler.start();

// Get DLQ stats
const stats = await dlqHandler.getStats();
console.log(`DLQ has ${stats.messageCount} messages`);
```

### Retry Policies

```typescript
import { withRetry, RetryPolicies } from '@solana-eda/rabbitmq';

// Execute with retry policy
const result = await withRetry(
  async () => await riskyOperation(),
  RetryPolicies.SHORT,
  (attempt, delay) => {
    console.log(`Retry ${attempt} after ${delay}ms`);
  }
);
```

## Docker Compose

RabbitMQ service is included in the project's docker-compose.yml:

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - '5672:5672'   # AMQP
      - '15672:15672' # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-solana}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:-solana123}
```

Management UI: http://localhost:15672 (solana/solana123)

## See Also

- [Phase 1 RabbitMQ Plan](../../../docs/PHASE1_RABBITMQ_RPC_PLAN.md)
- [Event Schema](../events/README.md)
- [Worker Patterns](../../../workers/README.md)
