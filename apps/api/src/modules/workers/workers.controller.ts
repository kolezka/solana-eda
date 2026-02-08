import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { WorkersService } from './workers.service';

class WorkerStatus {
  id!: string;
  name!: string;
  status!: 'RUNNING' | 'STOPPED' | 'ERROR';
  lastSeen!: string;
  metrics!: {
    eventsProcessed?: number;
    errors?: number;
    uptime?: number;
    tradesExecuted?: number;
    poolsMonitored?: number;
    startTime?: number;
  };
}

@ApiTags('workers')
@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all workers',
    description: 'Retrieves status information for all registered workers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved all workers',
    type: [WorkerStatus],
  })
  async getAllWorkers() {
    return await this.workersService.getAllWorkers();
  }

  @Get('running')
  @ApiOperation({
    summary: 'Get running workers',
    description: 'Retrieves all workers currently in RUNNING state.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved running workers',
    type: [WorkerStatus],
  })
  async getRunningWorkers() {
    return await this.workersService.getRunningWorkers();
  }

  @Get('errors')
  @ApiOperation({
    summary: 'Get workers with errors',
    description: 'Retrieves all workers currently in ERROR state.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved workers with errors',
    type: [WorkerStatus],
  })
  async getWorkersWithError() {
    return await this.workersService.getWorkersWithError();
  }

  @Get('stale')
  @ApiOperation({
    summary: 'Get stale workers',
    description:
      'Retrieves workers that have not reported status recently, indicating potential issues.',
  })
  @ApiQuery({
    name: 'olderThanMinutes',
    required: false,
    type: Number,
    description: "Consider workers stale if they haven't reported status within this many minutes",
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved stale workers',
    type: [WorkerStatus],
  })
  async getStaleWorkers(@Query('olderThanMinutes') olderThanMinutes: number = 5) {
    return await this.workersService.getStaleWorkers(olderThanMinutes);
  }

  @Get(':name')
  @ApiOperation({
    summary: 'Get worker by name',
    description: 'Retrieves detailed status information for a specific worker.',
  })
  @ApiParam({
    name: 'name',
    description: 'Worker name (e.g., liquidity-monitor, burn-detector, trading-bot)',
    example: 'liquidity-monitor',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved worker status',
    type: WorkerStatus,
  })
  @ApiResponse({
    status: 404,
    description: 'Worker not found',
  })
  async getWorkerByName(@Param('name') name: string) {
    return await this.workersService.getWorkerByName(name);
  }
}
