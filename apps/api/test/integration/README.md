# Integration Tests

This directory contains integration tests for the Solana EDA platform API.

## Test Suites

### 1. RPC Failover Integration (`rpc-failover.integration.spec.ts`)

Tests for RPC connection pool failover behavior:

- **Endpoint Health Detection**: Verifies that endpoints are correctly marked healthy/unhealthy based on consecutive failures/successes
- **Automatic Failover**: Tests failover to healthy endpoints when primary fails
- **Retry Logic**: Validates exponential backoff and max retry behavior
- **Pool Recovery**: Tests endpoint health recovery after outages
- **Rate Limiting**: Ensures per-endpoint rate limits are respected
- **Connection Selection**: Verifies priority-based endpoint selection

**Running**:
```bash
npm test -- rpc-failover.integration.spec
```

**Prerequisites**:
- At least one valid Solana RPC endpoint
- Network access to Solana RPC

### 2. WebSocket Reconnection Integration (`websocket-reconnection.integration.spec.ts`)

Tests for WebSocket connection management:

- **Initial Connection**: Verifies WebSocket connection establishment
- **Subscription Management**: Tests account change and log subscriptions
- **Reconnection Logic**: Validates automatic reconnection with exponential backoff
- **Connection State**: Tests connection state tracking and events
- **Subscription Restoration**: Ensures subscriptions are restored after reconnection
- **Graceful Shutdown**: Tests proper connection cleanup

**Running**:
```bash
npm test -- websocket-reconnection.integration.spec
```

**Prerequisites**:
- Valid Solana WebSocket endpoint
- Network access to Solana WebSocket

### 3. Priority Fee Integration (`priority-fee.integration.spec.ts`)

Tests for priority fee calculation:

- **Fee Calculation**: Tests fee calculation from network prioritization fees
- **Compute Unit Price**: Verifies compute unit price instruction creation
- **Compute Unit Limit**: Tests compute unit limit instruction creation
- **DEX Estimates**: Validates compute unit estimates for different DEXes
- **Transaction Complexity**: Tests fee adjustment based on transaction complexity
- **Error Handling**: Validates fallback behavior on errors

**Running**:
```bash
npm test -- priority-fee.integration.spec
```

**Prerequisites**:
- Valid Solana RPC endpoint
- Network access for fee data

### 4. Event Processing Integration (`event-processing.integration.spec.ts`)

Tests for end-to-end event flow:

- **Event Creation**: Validates event creation and validation
- **Redis Publishing**: Tests event publishing to Redis channels
- **Database Persistence**: Mock tests for event persistence
- **EventEmitter2**: Tests in-memory event bus integration
- **SSE Delivery**: Tests Server-Sent Events delivery
- **End-to-End Flow**: Tests complete event pipeline

**Running**:
```bash
npm test -- event-processing.integration.spec
```

**Prerequisites**:
- Redis server running
- Valid event schemas

## Environment Setup

### Required Environment Variables

```bash
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com

# Redis Configuration
REDIS_URL=redis://localhost:6379

# RabbitMQ Configuration (optional)
RABBITMQ_URL=amqp://localhost:5672

# Test Configuration
NODE_ENV=test
```

### Docker Compose Setup

For local testing, start required services:

```bash
docker-compose up -d postgres redis rabbitmq
```

## Running Tests

### Run All Integration Tests

```bash
npm test -- test/integration
```

### Run Specific Test Suite

```bash
npm test -- rpc-failover.integration.spec
```

### Run with Coverage

```bash
npm run test:cov -- test/integration
```

### Run in Watch Mode

```bash
npm run test:watch -- test/integration
```

## Test Utilities

The `test-setup.ts` file provides shared utilities:

- `getTestEnvironment()`: Creates test environment with Redis, Solana connection
- `setupTestEnvironment()`: Initializes test environment
- `teardownTestEnvironment()`: Cleans up test environment
- `waitForCondition()`: Waits for async conditions
- `TestEventCollector`: Collects and verifies events
- `createMockWebSocket()`: Creates mock WebSocket
- `createMockConnection()`: Creates mock Solana connection

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: solana_eda_test
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

      rabbitmq:
        image: rabbitmq:3-management-alpine
        ports:
          - 5672:5672
          - 15672:15672
        env:
          RABBITMQ_DEFAULT_USER: test
          RABBITMQ_DEFAULT_PASS: test

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: pnpm install

      - name: Run integration tests
        run: pnpm test -- test/integration
        env:
          SOLANA_RPC_URL: https://api.devnet.solana.com
          SOLANA_WS_URL: wss://api.devnet.solana.com
          REDIS_URL: redis://localhost:6379
          RABBITMQ_URL: amqp://test:test@localhost:5672
```

## Troubleshooting

### Common Issues

**Tests timeout**
- Increase test timeout in jest.config.js
- Check network connectivity to external services

**WebSocket tests fail**
- Verify SOLANA_WS_URL is correct
- Check firewall rules for WebSocket connections

**Redis tests fail**
- Ensure Redis is running: `docker-compose up redis`
- Check REDIS_URL environment variable

**RPC tests fail**
- Verify SOLANA_RPC_URL is accessible
- Check rate limits on RPC endpoints

### Debug Mode

Run tests with verbose output:

```bash
NODE_ENV=test DEBUG=* npm test -- test/integration
```

## Best Practices

1. **Isolation**: Each test should be independent and clean up after itself
2. **Deterministic**: Avoid randomness in tests; use fixed test data
3. **Fast**: Use mocks where appropriate; only test integration points
4. **Clear Naming**: Test names should clearly describe what is being tested
5. **One Assertion**: Prefer tests with single, clear assertions

## Contributing

When adding new integration tests:

1. Create a new `.integration.spec.ts` file
2. Use the test utilities from `test-setup.ts`
3. Document prerequisites in this README
4. Update the test suite list above
5. Ensure tests run in CI/CD pipeline

## Resources

- [Jest Documentation](https://jestjs.io/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Redis Documentation](https://redis.io/documentation)
