export interface WorkerConfig {
  name: string;
  enabled: boolean;
  interval?: number;
}

export interface WorkerStatus {
  name: string;
  status: 'RUNNING' | 'STOPPED' | 'ERROR';
  lastSeen: string;
  metrics: WorkerMetrics;
  error?: string;
}

export interface WorkerMetrics {
  eventsProcessed: number;
  errors: number;
  uptime: number;
  lastEventAt?: string;
  memoryUsage?: {
    used: number;
    total: number;
  };
}

export interface WorkerHealthCheck {
  healthy: boolean;
  status: WorkerStatus;
  checks: {
    redis: boolean;
    solana: boolean;
    database: boolean;
  };
}
