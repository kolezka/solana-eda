/**
 * Metrics collection and reporting
 * Compatible with Prometheus-style metrics
 */

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface Metric {
  name: string;
  type: MetricType;
  help: string;
  labels?: Record<string, string>;
  value: number;
  timestamp?: number;
}

export interface HistogramBucket {
  le: string;
  value: number;
}

export interface HistogramMetric extends Metric {
  type: 'histogram';
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

export class MetricsRegistry {
  private metrics = new Map<string, Metric>();
  private histograms = new Map<
    string,
    { buckets: number[]; values: number[]; sum: number; count: number }
  >();

  /**
   * Create or get a counter metric
   */
  counter(name: string, help: string): (value: number, labels?: Record<string, string>) => void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        type: 'counter',
        help,
        value: 0,
      });
    }

    return (value: number, labels?: Record<string, string>) => {
      const metric = this.metrics.get(name)!;
      metric.value += value;
      if (labels) {
        metric.labels = { ...metric.labels, ...labels };
      }
    };
  }

  /**
   * Create or get a gauge metric
   */
  gauge(name: string, help: string): (value: number, labels?: Record<string, string>) => void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        type: 'gauge',
        help,
        value: 0,
      });
    }

    return (value: number, labels?: Record<string, string>) => {
      const metric = this.metrics.get(name)!;
      metric.value = value;
      if (labels) {
        metric.labels = { ...metric.labels, ...labels };
      }
    };
  }

  /**
   * Create or get a histogram metric
   */
  histogram(
    name: string,
    help: string,
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  ): (value: number, labels?: Record<string, string>) => void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, {
        buckets: [...buckets, Infinity],
        values: [],
        sum: 0,
        count: 0,
      });
    }

    return (value: number, labels?: Record<string, string>) => {
      const histogram = this.histograms.get(name)!;
      histogram.values.push(value);
      histogram.sum += value;
      histogram.count++;

      // Create a simple metric for labels tracking
      if (!this.metrics.has(`${name}_count`)) {
        this.metrics.set(`${name}_count`, {
          name: `${name}_count`,
          type: 'counter',
          help,
          value: 0,
          labels,
        });
      }
      const countMetric = this.metrics.get(`${name}_count`)!;
      countMetric.value++;
    };
  }

  /**
   * Increment a counter metric
   */
  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    const counter = this.metrics.get(name);
    if (counter && counter.type === 'counter') {
      counter.value += value;
      if (labels) {
        counter.labels = { ...counter.labels, ...labels };
      }
    }
  }

  /**
   * Set a gauge metric
   */
  set(name: string, value: number, labels?: Record<string, string>): void {
    const gauge = this.metrics.get(name);
    if (gauge && gauge.type === 'gauge') {
      gauge.value = value;
      if (labels) {
        gauge.labels = { ...gauge.labels, ...labels };
      }
    }
  }

  /**
   * Record a timing observation
   */
  timing(name: string, durationMs: number, labels?: Record<string, string>): void {
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.values.push(durationMs);
      histogram.sum += durationMs;
      histogram.count++;
    }
  }

  /**
   * Get all metrics in Prometheus format
   */
  getMetrics(): string[] {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      // Help comment
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      // Type comment
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      // Metric value
      const labels = metric.labels
        ? `{${Object.entries(metric.labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',')}}`
        : '';
      lines.push(`${metric.name}${labels} ${metric.value}`);
    }

    // Histograms
    for (const [name, histogram] of this.histograms.entries()) {
      const help = this.metrics.get(`${name}_count`)?.help || '';
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} histogram`);

      // Bucket counts
      for (const le of histogram.buckets) {
        const count = histogram.values.filter((v) => v <= le).length;
        const leLabel = le === Infinity ? '+Inf' : le.toString();
        lines.push(`${name}_bucket{le="${leLabel}"} ${count}`);
      }

      // Sum and count
      lines.push(`${name}_sum ${histogram.sum}`);
      lines.push(`${name}_count ${histogram.count}`);
    }

    return lines;
  }

  /**
   * Get metrics as plain object
   */
  getMetricsAsObject(): Record<string, Metric | HistogramMetric> {
    const result: Record<string, Metric | HistogramMetric> = {};

    for (const metric of this.metrics.values()) {
      result[metric.name] = { ...metric };
    }

    for (const [name, histogram] of this.histograms.entries()) {
      const help = this.metrics.get(`${name}_count`)?.help || '';

      // Calculate bucket counts
      const buckets: HistogramBucket[] = [];
      for (const le of histogram.buckets) {
        const count = histogram.values.filter((v) => v <= le).length;
        buckets.push({
          le: le === Infinity ? '+Inf' : le.toString(),
          value: count,
        });
      }

      result[name] = {
        name,
        type: 'histogram',
        help,
        buckets,
        sum: histogram.sum,
        count: histogram.count,
        value: histogram.sum,
      };
    }

    return result;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.histograms.clear();
  }

  /**
   * Reset a specific metric
   */
  reset(name: string): void {
    this.metrics.delete(name);
    this.histograms.delete(name);
    // Clean up related metrics
    this.metrics.delete(`${name}_count`);
    this.metrics.delete(`${name}_sum`);
  }
}

/**
 * Global metrics registry
 */
let globalRegistry: MetricsRegistry | null = null;

export function getMetricsRegistry(): MetricsRegistry {
  if (!globalRegistry) {
    globalRegistry = new MetricsRegistry();
  }
  return globalRegistry;
}

/**
 * Common metrics definitions
 */
export const COMMON_METRICS = {
  // Request metrics
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_REQUEST_DURATION_MS: 'http_request_duration_ms',
  HTTP_REQUESTS_IN_PROGRESS: 'http_requests_in_progress',

  // Worker metrics
  WORKER_EVENTS_PROCESSED: 'worker_events_processed',
  WORKER_ERRORS_TOTAL: 'worker_errors_total',
  WORKER_UPTIME_SECONDS: 'worker_uptime_seconds',
  WORKER_LAST_EVENT_TIMESTAMP: 'worker_last_event_timestamp',

  // Trading metrics
  TRADES_TOTAL: 'trades_total',
  TRADES_SUCCESSFUL: 'trades_successful',
  TRADES_FAILED: 'trades_failed',
  POSITION_PNL: 'position_pnl',
  PORTFOLIO_VALUE: 'portfolio_value_usd',

  // Database metrics
  DB_QUERY_DURATION_MS: 'db_query_duration_ms',
  DB_CONNECTIONS_ACTIVE: 'db_connections_active',
  DB_CONNECTIONS_IDLE: 'db_connections_idle',

  // Solana RPC metrics
  SOLANA_RPC_REQUESTS_TOTAL: 'solana_rpc_requests_total',
  SOLANA_RPC_REQUEST_DURATION_MS: 'solana_rpc_request_duration_ms',
  SOLANA_RPC_ERRORS_TOTAL: 'solana_rpc_errors_total',

  // Redis metrics
  REDIS_COMMANDS_TOTAL: 'redis_commands_total',
  REDIS_COMMAND_DURATION_MS: 'redis_command_duration_ms',
  REDIS_CONNECTIONS_ACTIVE: 'redis_connections_active',
};

/**
 * Initialize common metrics
 */
export function initializeCommonMetrics(registry: MetricsRegistry): void {
  // Request metrics
  registry.counter(COMMON_METRICS.HTTP_REQUESTS_TOTAL, 'Total HTTP requests');
  registry.histogram(
    COMMON_METRICS.HTTP_REQUEST_DURATION_MS,
    'HTTP request duration in milliseconds',
  );
  registry.gauge(COMMON_METRICS.HTTP_REQUESTS_IN_PROGRESS, 'HTTP requests currently in progress');

  // Worker metrics
  registry.counter(COMMON_METRICS.WORKER_EVENTS_PROCESSED, 'Total events processed by workers');
  registry.counter(COMMON_METRICS.WORKER_ERRORS_TOTAL, 'Total worker errors');
  registry.gauge(COMMON_METRICS.WORKER_UPTIME_SECONDS, 'Worker uptime in seconds');
  registry.gauge(COMMON_METRICS.WORKER_LAST_EVENT_TIMESTAMP, 'Timestamp of last worker event');

  // Trading metrics
  registry.counter(COMMON_METRICS.TRADES_TOTAL, 'Total trades executed');
  registry.counter(COMMON_METRICS.TRADES_SUCCESSFUL, 'Total successful trades');
  registry.counter(COMMON_METRICS.TRADES_FAILED, 'Total failed trades');
  registry.gauge(COMMON_METRICS.POSITION_PNL, 'Current position P&L');
  registry.gauge(COMMON_METRICS.PORTFOLIO_VALUE, 'Portfolio value in USD');

  // Database metrics
  registry.histogram(
    COMMON_METRICS.DB_QUERY_DURATION_MS,
    'Database query duration in milliseconds',
  );
  registry.gauge(COMMON_METRICS.DB_CONNECTIONS_ACTIVE, 'Active database connections');
  registry.gauge(COMMON_METRICS.DB_CONNECTIONS_IDLE, 'Idle database connections');

  // Solana RPC metrics
  registry.counter(COMMON_METRICS.SOLANA_RPC_REQUESTS_TOTAL, 'Total Solana RPC requests');
  registry.histogram(
    COMMON_METRICS.SOLANA_RPC_REQUEST_DURATION_MS,
    'Solana RPC request duration in milliseconds',
  );
  registry.counter(COMMON_METRICS.SOLANA_RPC_ERRORS_TOTAL, 'Total Solana RPC errors');

  // Redis metrics
  registry.counter(COMMON_METRICS.REDIS_COMMANDS_TOTAL, 'Total Redis commands');
  registry.histogram(
    COMMON_METRICS.REDIS_COMMAND_DURATION_MS,
    'Redis command duration in milliseconds',
  );
  registry.gauge(COMMON_METRICS.REDIS_CONNECTIONS_ACTIVE, 'Active Redis connections');
}
