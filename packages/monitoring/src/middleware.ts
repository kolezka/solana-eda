/**
 * Express/NestJS middleware for monitoring
 */

import type { Request, Response, NextFunction } from 'express';
import { getMetricsRegistry, COMMON_METRICS } from './metrics';
import { getLogger, LogLevel } from './logger';
import { getHealthChecker, HealthStatus } from './health-check';

const logger = getLogger('monitoring');
const metricsRegistry = getMetricsRegistry();
const healthChecker = getHealthChecker();

/**
 * Request logging middleware
 */
export function requestLogging(options: {
  excludePaths?: string[];
  logLevel?: LogLevel;
} = {}) {
  const { excludePaths = [], logLevel = LogLevel.INFO } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const path = req.path;

    // Check if path should be excluded
    if (excludePaths.some(excluded => path.includes(excluded))) {
      return next();
    }

    // Log request based on log level
    const logData = {
      method: req.method,
      path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    switch (logLevel) {
      case LogLevel.DEBUG:
        logger.debug(`${req.method} ${path}`, logData);
        break;
      case LogLevel.INFO:
        logger.info(`${req.method} ${path}`, logData);
        break;
      case LogLevel.WARN:
        logger.warn(`${req.method} ${path}`, logData);
        break;
      default:
        logger.info(`${req.method} ${path}`, logData);
    }

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - start;

      const responseLogData = {
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: duration,
      };

      if (res.statusCode >= 400) {
        logger.warn(`${req.method} ${path} ${res.statusCode}`, responseLogData);
      } else {
        switch (logLevel) {
          case LogLevel.DEBUG:
            logger.debug(`${req.method} ${path} ${res.statusCode}`, responseLogData);
            break;
          case LogLevel.INFO:
            logger.info(`${req.method} ${path} ${res.statusCode}`, responseLogData);
            break;
          case LogLevel.WARN:
            logger.warn(`${req.method} ${path} ${res.statusCode}`, responseLogData);
            break;
          default:
            logger.info(`${req.method} ${path} ${res.statusCode}`, responseLogData);
        }
      }

      // Record metrics
      metricsRegistry.increment(COMMON_METRICS.HTTP_REQUESTS_TOTAL, 1, {
        method: req.method,
        path,
        status: res.statusCode.toString(),
      });

      metricsRegistry.timing(COMMON_METRICS.HTTP_REQUEST_DURATION_MS, duration, {
        method: req.method,
        path,
      });
    });

    next();
  };
}

/**
 * Request metrics middleware
 */
export function requestMetrics() {
  const requestsInProgress = metricsRegistry.gauge(
    COMMON_METRICS.HTTP_REQUESTS_IN_PROGRESS,
    'HTTP requests currently in progress'
  );

  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    // Increment in-progress counter
    requestsInProgress(
      (parseInt(metricsRegistry.getMetricsAsObject()[COMMON_METRICS.HTTP_REQUESTS_IN_PROGRESS]?.value.toString() || '0') || 0) + 1
    );

    // Record metrics on response finish
    res.on('finish', () => {
      const duration = Date.now() - start;

      metricsRegistry.increment(COMMON_METRICS.HTTP_REQUESTS_TOTAL, 1, {
        method: req.method,
        path: req.path,
        status: res.statusCode.toString(),
      });

      metricsRegistry.timing(COMMON_METRICS.HTTP_REQUEST_DURATION_MS, duration, {
        method: req.method,
        path: req.path,
      });

      // Decrement in-progress counter
      requestsInProgress(
        (parseInt(metricsRegistry.getMetricsAsObject()[COMMON_METRICS.HTTP_REQUESTS_IN_PROGRESS]?.value.toString() || '0') || 0) - 1
      );
    });

    next();
  };
}

/**
 * Error tracking middleware
 */
export function errorTracking() {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(`Unhandled error: ${err.message}`, err, {
      path: req.path,
      method: req.method,
      query: req.query,
      body: req.body,
    });

    // Record error metric
    metricsRegistry.increment('http_errors_total', 1, {
      method: req.method,
      path: req.path,
      errorType: err.name,
    });

    next(err);
  };
}

/**
 * Health check endpoint handler
 */
export function healthCheckHandler(options: {
  includeDetails?: boolean;
  runChecks?: boolean;
} = {}) {
  return async (req: Request, res: Response) => {
    try {
      const result = options.runChecks
        ? await healthChecker.runAllChecks()
        : healthChecker.getCurrentStatus();

      const statusCode = result.status === HealthStatus.HEALTHY
        ? 200
        : result.status === HealthStatus.DEGRADED
        ? 200 // Still return 200 for degraded but include details
        : 503;

      res.status(statusCode).json(
        options.includeDetails
          ? result
          : { status: result.status, timestamp: result.timestamp }
      );
    } catch (error) {
      res.status(503).json({
        status: HealthStatus.UNHEALTHY,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Metrics endpoint handler (Prometheus format)
 */
export function metricsHandler() {
  return (req: Request, res: Response) => {
    const metrics = metricsRegistry.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics.join('\n'));
  };
}

/**
 * Readiness probe handler
 */
export function readinessHandler(options: {
  checks?: string[];
} = {}) {
  return async (req: Request, res: Response) => {
    try {
      const result = await healthChecker.runAllChecks();

      // Filter to only specified checks if provided
      let checks = result.checks;
      if (options.checks && options.checks.length > 0) {
        checks = {};
        for (const checkName of options.checks) {
          if (result.checks[checkName]) {
            checks[checkName] = result.checks[checkName];
          }
        }
      }

      const allHealthy = Object.values(checks).every(
        check => check.status === HealthStatus.HEALTHY
      );

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'ready' : 'not_ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Liveness probe handler
 */
export function livenessHandler() {
  return (req: Request, res: Response) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  };
}

/**
 * Request ID middleware
 */
export function requestId() {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.headers['x-request-id'] as string || generateRequestId();
    res.setHeader('X-Request-ID', id);
    (req as any).requestId = id;
    next();
  };
}

/**
 * Response time middleware
 */
export function responseTime() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      res.setHeader('X-Response-Time', `${duration}ms`);
    });

    next();
  };
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
