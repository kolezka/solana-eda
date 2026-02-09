/**
 * Worker lifecycle management
 * Provides graceful shutdown, startup sequencing, and health monitoring for workers
 */

import {
  WorkerState,
  WorkerHealthManager,
  createWorkerHealthConfig,
  type WorkerHealthConfig,
} from './worker-health';
import type { Redis } from 'ioredis';

/**
 * Worker lifecycle state
 */
export interface WorkerLifecycleState {
  phase: 'INITIALIZING' | 'STARTING' | 'READY' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'ERROR';
  startTime: number;
  readyTime?: number;
  stopTime?: number;
  error?: Error;
}

/**
 * Startup step definition
 */
export interface StartupStep {
  name: string;
  execute: () => Promise<void>;
  timeout?: number;
  critical: boolean;
}

/**
 * Shutdown step definition
 */
export interface ShutdownStep {
  name: string;
  execute: (signal: NodeJS.Signals) => Promise<void> | void;
  timeout?: number;
  order: 'FIRST' | 'NORMAL' | 'LAST';
}

/**
 * Worker lifecycle manager configuration
 */
export interface WorkerLifecycleConfig {
  workerName: string;
  healthConfig?: WorkerHealthConfig;
  gracefulShutdownTimeout?: number;
  drainTimeout?: number;
  startupSteps?: StartupStep[];
  shutdownSteps?: ShutdownStep[];
  onStateChange?: (state: WorkerLifecycleState) => void;
}

/**
 * Worker lifecycle manager
 */
export class WorkerLifecycleManager {
  private workerName: string;
  private healthManager: WorkerHealthManager;
  private lifecycleState: WorkerLifecycleState;
  private config: WorkerLifecycleConfig;
  private shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGUSR2'];
  private signalHandlers: Map<NodeJS.Signals, NodeJS.SignalsListener> = new Map();
  private isShuttingDown = false;
  private drainPromise: Promise<void> | null = null;
  private drainResolve: (() => void) | null = null;

  private startupSteps: StartupStep[];
  private shutdownSteps: ShutdownStep[];

  constructor(config: WorkerLifecycleConfig) {
    this.workerName = config.workerName;
    this.config = config;

    // Initialize health manager
    this.healthManager = new WorkerHealthManager(
      config.healthConfig || {
        workerName: config.workerName,
      },
    );

    // Initialize lifecycle state
    this.lifecycleState = {
      phase: 'INITIALIZING',
      startTime: Date.now(),
    };

    // Initialize startup/shutdown steps
    this.startupSteps = config.startupSteps || [];
    this.shutdownSteps = config.shutdownSteps || [];

    // Setup default shutdown steps if not provided
    if (!this.config.shutdownSteps) {
      this.shutdownSteps = [
        {
          name: 'update-status',
          execute: async () => {
            this.lifecycleState.phase = 'STOPPING';
            this.healthManager.setState(WorkerState.STOPPING);
            this.notifyStateChange();
          },
          timeout: 5000,
          order: 'FIRST',
        },
        {
          name: 'drain',
          execute: async () => {
            await this.drain();
          },
          timeout: config.drainTimeout || 30000,
          order: 'NORMAL',
        },
        {
          name: 'cleanup',
          execute: async () => {
            this.healthManager.shutdown();
          },
          timeout: 5000,
          order: 'LAST',
        },
      ];
    }
  }

  /**
   * Start the worker lifecycle
   */
  async start(): Promise<void> {
    this.lifecycleState.phase = 'STARTING';
    this.healthManager.setState(WorkerState.STARTING);
    this.notifyStateChange();

    try {
      // Execute startup steps
      for (const step of this.startupSteps) {
        await this.executeStartupStep(step);
      }

      // Mark as ready
      this.lifecycleState.phase = 'READY';
      this.lifecycleState.readyTime = Date.now();
      this.healthManager.setState(WorkerState.READY);
      this.notifyStateChange();

      // Setup signal handlers for graceful shutdown
      this.setupSignalHandlers();

      console.log(`[${this.workerName}] Worker started successfully`);
    } catch (error) {
      this.lifecycleState.phase = 'ERROR';
      this.lifecycleState.error = error as Error;
      this.healthManager.setState(WorkerState.ERROR);
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Mark worker as running (processing events)
   */
  markRunning(): void {
    if (this.lifecycleState.phase === 'READY') {
      this.lifecycleState.phase = 'RUNNING';
      this.healthManager.setState(WorkerState.PROCESSING);
      this.notifyStateChange();
    }
  }

  /**
   * Mark worker as idle
   */
  markIdle(): void {
    if (this.lifecycleState.phase === 'RUNNING') {
      this.lifecycleState.phase = 'READY';
      this.healthManager.setState(WorkerState.IDLE);
      this.notifyStateChange();
    }
  }

  /**
   * Get current lifecycle state
   */
  getState(): WorkerLifecycleState {
    return { ...this.lifecycleState };
  }

  /**
   * Get health manager
   */
  getHealthManager(): WorkerHealthManager {
    return this.healthManager;
  }

  /**
   * Get health status
   */
  async getHealthStatus() {
    return this.healthManager.getHealthStatus();
  }

  /**
   * Check if worker is ready
   */
  isReady(): boolean {
    return this.healthManager.isReady();
  }

  /**
   * Check if worker is alive
   */
  isAlive(): boolean {
    return this.healthManager.isAlive();
  }

  /**
   * Execute a startup step with timeout
   */
  private async executeStartupStep(step: StartupStep): Promise<void> {
    const timeout = step.timeout || 30000; // 30 seconds default

    try {
      console.log(`[${this.workerName}] Executing startup step: ${step.name}`);

      await Promise.race([
        step.execute(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`Startup step '${step.name}' timeout`)), timeout),
        ),
      ]);

      console.log(`[${this.workerName}] Startup step completed: ${step.name}`);
    } catch (error) {
      console.error(`[${this.workerName}] Startup step failed: ${step.name}`, error);

      if (step.critical) {
        throw error;
      }

      console.warn(`[${this.workerName}] Non-critical step failed, continuing: ${step.name}`);
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    for (const signal of this.shutdownSignals) {
      const handler = async () => {
        console.log(`[${this.workerName}] Received ${signal}, initiating shutdown...`);
        await this.shutdown(signal);
      };

      process.on(signal, handler);
      this.signalHandlers.set(signal, handler);
    }

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
      console.error(`[${this.workerName}] Uncaught exception:`, error);
      this.lifecycleState.phase = 'ERROR';
      this.lifecycleState.error = error;
      this.notifyStateChange();

      // Try to shutdown gracefully
      await this.shutdown('SIGTERM').catch(() => {
        // Force exit if graceful shutdown fails
        process.exit(1);
      });
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error(`[${this.workerName}] Unhandled rejection at:`, promise, 'reason:', reason);
      this.lifecycleState.phase = 'ERROR';
      this.lifecycleState.error = new Error(String(reason));
      this.notifyStateChange();
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
    if (this.isShuttingDown) {
      console.log(`[${this.workerName}] Shutdown already in progress`);
      return;
    }

    this.isShuttingDown = true;
    const shutdownTimeout = this.config.gracefulShutdownTimeout || 60000; // 60 seconds default

    console.log(`[${this.workerName}] Starting graceful shutdown...`);

    try {
      // Sort shutdown steps by order
      const sortedSteps = [...this.shutdownSteps].sort((a, b) => {
        const orderMap = { FIRST: 0, NORMAL: 1, LAST: 2 };
        return orderMap[a.order] - orderMap[b.order];
      });

      // Execute shutdown steps with overall timeout
      await Promise.race([
        (async () => {
          for (const step of sortedSteps) {
            try {
              console.log(`[${this.workerName}] Executing shutdown step: ${step.name}`);

              await Promise.race([
                step.execute(signal),
                new Promise<void>((_, reject) =>
                  setTimeout(
                    () => reject(new Error(`Shutdown step '${step.name}' timeout`)),
                    step.timeout || 10000,
                  ),
                ),
              ]);

              console.log(`[${this.workerName}] Shutdown step completed: ${step.name}`);
            } catch (error) {
              console.error(`[${this.workerName}] Shutdown step failed: ${step.name}`, error);
              // Continue with other shutdown steps even if this one fails
            }
          }
        })(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Shutdown timeout')), shutdownTimeout),
        ),
      ]);

      this.lifecycleState.phase = 'STOPPED';
      this.lifecycleState.stopTime = Date.now();
      this.notifyStateChange();

      console.log(`[${this.workerName}] Shutdown complete`);
    } catch (error) {
      console.error(`[${this.workerName}] Shutdown error:`, error);
      this.lifecycleState.phase = 'ERROR';
      this.lifecycleState.error = error as Error;
      this.notifyStateChange();
    } finally {
      // Remove signal handlers
      for (const [signal, handler] of this.signalHandlers.entries()) {
        process.removeListener(signal, handler);
      }
      this.signalHandlers.clear();
    }
  }

  /**
   * Drain - stop accepting new work and wait for current work to complete
   */
  private async drain(): Promise<void> {
    if (this.drainPromise) {
      return this.drainPromise;
    }

    console.log(`[${this.workerName}] Draining...`);

    this.drainPromise = new Promise((resolve) => {
      this.drainResolve = resolve;

      // Set a timeout to resolve even if work doesn't complete
      setTimeout(() => {
        console.warn(`[${this.workerName}] Drain timeout, forcing shutdown`);
        resolve();
      }, this.config.drainTimeout || 30000);
    });

    await this.drainPromise;
  }

  /**
   * Indicate that the drain can complete
   * Call this when all in-flight work is complete
   */
  drainComplete(): void {
    if (this.drainResolve) {
      console.log(`[${this.workerName}] Drain complete`);
      this.drainResolve();
      this.drainResolve = null;
      this.drainPromise = null;
    }
  }

  /**
   * Notify state change listeners
   */
  private notifyStateChange(): void {
    if (this.config.onStateChange) {
      this.config.onStateChange(this.getState());
    }
  }

  /**
   * Publish worker status to Redis for monitoring
   */
  async publishStatus(redis: Redis): Promise<void> {
    const health = await this.getHealthStatus();

    const status = {
      workerName: this.workerName,
      phase: this.lifecycleState.phase,
      startTime: this.lifecycleState.startTime,
      readyTime: this.lifecycleState.readyTime,
      stopTime: this.lifecycleState.stopTime,
      health,
      timestamp: new Date().toISOString(),
    };

    await redis.setex(
      `worker:status:${this.workerName}`,
      60, // Expire after 60 seconds
      JSON.stringify(status),
    );
  }

  /**
   * Record event processing in health manager
   */
  recordEventProcessed(processingTimeMs: number): void {
    this.healthManager.recordEventProcessed(processingTimeMs);
    this.markRunning();
  }

  /**
   * Record error in health manager
   */
  recordError(error: string): void {
    this.healthManager.recordError(error);
  }
}

/**
 * Factory to create a standard worker lifecycle configuration
 */
export function createWorkerLifecycleConfig(
  workerName: string,
  dependencies: {
    redis?: Redis;
    database?: any;
    solanaRPC?: any;
    solanaWS?: any;
  },
  customSteps?: {
    startup?: StartupStep[];
    shutdown?: ShutdownStep[];
  },
): WorkerLifecycleConfig {
  const healthConfig = createWorkerHealthConfig(workerName, dependencies);

  return {
    workerName,
    healthConfig,
    gracefulShutdownTimeout: 60000,
    drainTimeout: 30000,
    startupSteps: customSteps?.startup || [],
    shutdownSteps: customSteps?.shutdown || [],
  };
}

/**
 * Setup standard worker lifecycle with automatic signal handling
 */
export function setupWorkerLifecycle(
  workerName: string,
  dependencies: {
    redis: Redis;
    database: any;
    solanaRPC: any;
    solanaWS?: any;
  },
  options?: {
    onReady?: () => void;
    onError?: (error: Error) => void;
    periodicStatusUpdate?: boolean; // Publish status to Redis periodically
    statusUpdateInterval?: number; // Seconds
  },
): WorkerLifecycleManager {
  const config = createWorkerLifecycleConfig(workerName, dependencies);

  const lifecycle = new WorkerLifecycleManager(config);

  // Setup periodic status updates
  if (options?.periodicStatusUpdate !== false) {
    const interval = options?.statusUpdateInterval || 30; // 30 seconds default

    setInterval(async () => {
      if (lifecycle.isAlive()) {
        await lifecycle.publishStatus(dependencies.redis);
      }
    }, interval * 1000);
  }

  // Override start to call onReady
  const originalStart = lifecycle.start.bind(lifecycle);
  lifecycle.start = async () => {
    try {
      await originalStart();
      if (options?.onReady) {
        options.onReady();
      }
    } catch (error) {
      if (options?.onError) {
        options.onError(error as Error);
      }
      throw error;
    }
  };

  return lifecycle;
}
