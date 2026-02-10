import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { QueuesService } from './queues.service';
import { BullMQQueueHealth, BullMQSystemHealth, BullMQWorkerHealth, HealthStatus } from '@solana-eda/monitoring';

/**
 * Queue metrics response DTO
 */
class QueueMetricsDTO {
  queueName!: string;
  waiting!: number;
  active!: number;
  completed!: number;
  failed!: number;
  delayed!: number;
  paused!: boolean;
  isPaused!: boolean;
  timestamp!: string;
}

/**
 * Queue health status response DTO
 */
class QueueHealthDTO {
  queueName!: string;
  status!: HealthStatus;
  metrics!: QueueMetricsDTO;
  timestamp!: string;
}

/**
 * System health status response DTO
 */
class SystemHealthDTO {
  status!: HealthStatus;
  queues!: Record<string, QueueHealthDTO>;
  workers!: Record<string, WorkerStatusDTO>;
  timestamp!: string;
}

/**
 * Queue status overview DTO
 */
class QueuesStatusDTO {
  totalQueues!: number;
  healthyQueues!: number;
  degradedQueues!: number;
  unhealthyQueues!: number;
  totalWaiting!: number;
  totalActive!: number;
  totalCompleted!: number;
  totalFailed!: number;
  queues!: Record<string, QueueMetricsDTO>;
  timestamp!: string;
}

/**
 * Worker status DTO
 */
class WorkerStatusDTO {
  workerName!: string;
  status!: HealthStatus;
  isRunning!: boolean;
  isProcessing!: boolean;
  concurrency!: number;
  jobsProcessed!: number;
  jobsFailed!: number;
  timestamp!: string;
}

@ApiTags('queues')
@Controller('api/queues')
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get overall queue status',
    description: 'Retrieves health and metrics summary for all BullMQ queues.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved queue status',
    type: QueuesStatusDTO,
  })
  async getQueuesStatus(): Promise<QueuesStatusDTO> {
    return await this.queuesService.getQueuesStatus();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Get BullMQ system health',
    description: 'Retrieves overall health status of the BullMQ system including all queues and workers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved system health',
    type: SystemHealthDTO,
  })
  async getSystemHealth(): Promise<SystemHealthDTO> {
    return await this.queuesService.getSystemHealth();
  }

  @Get(':queueName')
  @ApiOperation({
    summary: 'Get specific queue details',
    description: 'Retrieves detailed metrics for a specific queue.',
  })
  @ApiParam({
    name: 'queueName',
    description: 'Name of the queue (e.g., solana:burn-events, solana:trade-events)',
    example: 'solana:burn-events',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved queue details',
    type: QueueMetricsDTO,
  })
  @ApiResponse({
    status: 404,
    description: 'Queue not found',
  })
  async getQueueDetails(@Param('queueName') queueName: string): Promise<QueueMetricsDTO | null> {
    return await this.queuesService.getQueueDetails(queueName);
  }

  @Get(':queueName/health')
  @ApiOperation({
    summary: 'Get queue health status',
    description: 'Retrieves health status for a specific queue.',
  })
  @ApiParam({
    name: 'queueName',
    description: 'Name of the queue (e.g., solana:burn-events, solana:trade-events)',
    example: 'solana:burn-events',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved queue health',
    type: QueueHealthDTO,
  })
  @ApiResponse({
    status: 404,
    description: 'Queue not found',
  })
  async getQueueHealth(@Param('queueName') queueName: string): Promise<QueueHealthDTO> {
    return await this.queuesService.getQueueHealth(queueName);
  }

  @Get('workers/status')
  @ApiOperation({
    summary: 'Get BullMQ workers status',
    description: 'Retrieves status of all BullMQ workers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved workers status',
    type: [WorkerStatusDTO],
  })
  async getWorkersStatus(): Promise<Record<string, WorkerStatusDTO>> {
    return await this.queuesService.getWorkersStatus();
  }

  @Get('workers/:workerName')
  @ApiOperation({
    summary: 'Get specific worker status',
    description: 'Retrieves detailed status for a specific BullMQ worker.',
  })
  @ApiParam({
    name: 'workerName',
    description: 'Name of the worker',
    example: 'burn-processor',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved worker status',
    type: WorkerStatusDTO,
  })
  @ApiResponse({
    status: 404,
    description: 'Worker not found',
  })
  async getWorkerStatus(@Param('workerName') workerName: string): Promise<WorkerStatusDTO | null> {
    return await this.queuesService.getWorkerStatus(workerName);
  }
}
