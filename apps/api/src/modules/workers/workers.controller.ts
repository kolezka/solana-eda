import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { WorkersService } from './workers.service';
import type { WorkerStatusRecord } from '@solana-eda/database';

class WorkerStatusDTO {
  id!: string;
  name!: string;
  status!: string;
  lastSeen!: Date;
  metrics!: Record<string, unknown> | null;
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
    type: [WorkerStatusDTO],
  })
  async getAllWorkers(): Promise<WorkerStatusRecord[]> {
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
    type: [WorkerStatusDTO],
  })
  async getRunningWorkers(): Promise<WorkerStatusRecord[]> {
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
    type: [WorkerStatusDTO],
  })
  async getWorkersWithError(): Promise<WorkerStatusRecord[]> {
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
    type: [WorkerStatusDTO],
  })
  async getStaleWorkers(
    @Query('olderThanMinutes') olderThanMinutes: number = 5,
  ): Promise<WorkerStatusRecord[]> {
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
    type: WorkerStatusDTO,
  })
  @ApiResponse({
    status: 404,
    description: 'Worker not found',
  })
  async getWorkerByName(@Param('name') name: string): Promise<WorkerStatusRecord | null> {
    return await this.workersService.getWorkerByName(name);
  }
}
