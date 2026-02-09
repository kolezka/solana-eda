#!/bin/bash

# Integration Test Runner for Solana EDA Platform
# This script sets up the test environment and runs integration tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default configuration
ENVIRONMENT="${NODE_ENV:-test}"
SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
SOLANA_WS_URL="${SOLANA_WS_URL:-wss://api.devnet.solana.com}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
RABBITMQ_URL="${RABBITMQ_URL:-amqp://solana:solana123@localhost:5672}"

# Test suites
TEST_SUITES=("all" "rpc" "ws" "fee" "events")
SELECTED_SUITE="${1:-all}"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed or not in PATH"
        exit 1
    fi

    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed or not in PATH"
        exit 1
    fi

    log_info "All dependencies are available"
}

start_services() {
    log_info "Starting required services..."

    # Start Docker Compose services
    docker-compose up -d postgres redis rabbitmq

    # Wait for services to be healthy
    log_info "Waiting for services to be ready..."

    # Wait for Redis
    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker exec solana-eda-redis-1 redis-cli ping > /dev/null 2>&1; then
            log_info "Redis is ready"
            break
        fi
        attempt=$((attempt + 1))
        sleep 1
    done

    if [ $attempt -eq $max_attempts ]; then
        log_error "Redis failed to start"
        exit 1
    fi

    # Wait for PostgreSQL
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker exec solana-eda-postgres-1 pg_isready -U postgres > /dev/null 2>&1; then
            log_info "PostgreSQL is ready"
            break
        fi
        attempt=$((attempt + 1))
        sleep 1
    done

    if [ $attempt -eq $max_attempts ]; then
        log_error "PostgreSQL failed to start"
        exit 1
    fi

    # Wait for RabbitMQ
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker exec solana-eda-rabbitmq-1 rabbitmq-diagnostics -q ping > /dev/null 2>&1; then
            log_info "RabbitMQ is ready"
            break
        fi
        attempt=$((attempt + 1))
        sleep 1
    done

    if [ $attempt -eq $max_attempts ]; then
        log_warn "RabbitMQ may not be ready (optional for some tests)"
    fi

    log_info "All services are ready"
}

run_tests() {
    log_info "Running integration tests..."

    # Export environment variables for tests
    export NODE_ENV="$ENVIRONMENT"
    export SOLANA_RPC_URL="$SOLANA_RPC_URL"
    export SOLANA_WS_URL="$SOLANA_WS_URL"
    export REDIS_URL="$REDIS_URL"
    export RABBITMQ_URL="$RABBITMQ_URL"

    # Change to API directory
    cd apps/api

    case "$SELECTED_SUITE" in
        all)
            log_info "Running all integration tests..."
            pnpm test:integration
            ;;
        rpc)
            log_info "Running RPC failover tests..."
            pnpm test:integration:rpc
            ;;
        ws)
            log_info "Running WebSocket reconnection tests..."
            pnpm test:integration:ws
            ;;
        fee)
            log_info "Running priority fee tests..."
            pnpm test:integration:fee
            ;;
        events)
            log_info "Running event processing tests..."
            pnpm test:integration:events
            ;;
        *)
            log_error "Unknown test suite: $SELECTED_SUITE"
            log_info "Available suites: ${TEST_SUITES[*]}"
            exit 1
            ;;
    esac

    # Return to project root
    cd ../..

    log_info "Tests completed"
}

stop_services() {
    log_info "Stopping services..."
    docker-compose down
    log_info "Services stopped"
}

print_usage() {
    cat << EOF
Usage: $0 [test_suite]

Available test suites:
  all    - Run all integration tests (default)
  rpc    - Run RPC failover tests only
  ws     - Run WebSocket reconnection tests only
  fee    - Run priority fee tests only
  events - Run event processing tests only

Environment variables:
  NODE_ENV           - Test environment (default: test)
  SOLANA_RPC_URL     - Solana RPC endpoint (default: https://api.devnet.solana.com)
  SOLANA_WS_URL      - Solana WebSocket endpoint (default: wss://api.devnet.solana.com)
  REDIS_URL          - Redis connection URL (default: redis://localhost:6379)
  RABBITMQ_URL       - RabbitMQ connection URL (default: amqp://solana:solana123@localhost:5672)

Examples:
  $0                 # Run all tests
  $0 rpc             # Run RPC failover tests only
  SOLANA_RPC_URL=https://api.mainnet-beta.solana.com $0 all  # Use mainnet

EOF
}

# Main execution
main() {
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║   Solana EDA Platform - Integration Test Runner              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    # Parse arguments
    if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
        print_usage
        exit 0
    fi

    log_info "Configuration:"
    log_info "  Environment: $ENVIRONMENT"
    log_info "  Solana RPC: $SOLANA_RPC_URL"
    log_info "  Solana WS: $SOLANA_WS_URL"
    log_info "  Redis: $REDIS_URL"
    log_info "  RabbitMQ: $RABBITMQ_URL"
    log_info "  Test Suite: $SELECTED_SUITE"
    echo ""

    # Check dependencies
    check_dependencies

    # Start services
    start_services

    # Run tests
    run_tests

    # Clean up
    if [[ "${AUTO_CLEANUP:-true}" == "true" ]]; then
        stop_services
    else
        log_warn "Services left running (set AUTO_CLEANUP=true to stop)"
    fi

    echo ""
    log_info "Integration test run completed successfully!"
}

# Trap to handle Ctrl+C
trap 'log_error "Test run interrupted"; stop_services; exit 1' INT

# Run main function
main "$@"
