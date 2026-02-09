import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { WorkerStatusRepository } from '@solana-eda/database';
import type { WorkerStatusRecord } from '@solana-eda/database';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkersService {
  constructor(@Inject('PRISMA') private prisma: PrismaService) {
    this.workerStatusRepo = new WorkerStatusRepository(this.prisma);
  }

  private workerStatusRepo: WorkerStatusRepository;

  async getAllWorkers(): Promise<WorkerStatusRecord[]> {
    return await this.workerStatusRepo.findAll();
  }

  async getWorkerByName(name: string): Promise<WorkerStatusRecord | null> {
    return await this.workerStatusRepo.findByName(name);
  }

  async getRunningWorkers(): Promise<WorkerStatusRecord[]> {
    return await this.workerStatusRepo.findRunning();
  }

  async getWorkersWithError(): Promise<WorkerStatusRecord[]> {
    return await this.workerStatusRepo.findWithError();
  }

  async getStaleWorkers(olderThanMinutes: number = 5): Promise<WorkerStatusRecord[]> {
    return await this.workerStatusRepo.findStaleWorkers(olderThanMinutes);
  }
}
