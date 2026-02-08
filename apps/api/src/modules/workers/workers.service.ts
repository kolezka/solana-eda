import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { WorkerStatusRepository } from '@solana-eda/database';

@Injectable()
export class WorkersService {
  constructor(@Inject('PRISMA') private prisma: PrismaClient) {
    this.workerStatusRepo = new WorkerStatusRepository(this.prisma);
  }

  private workerStatusRepo: WorkerStatusRepository;

  async getAllWorkers() {
    return await this.workerStatusRepo.findAll();
  }

  async getWorkerByName(name: string) {
    return await this.workerStatusRepo.findByName(name);
  }

  async getRunningWorkers() {
    return await this.workerStatusRepo.findRunning();
  }

  async getWorkersWithError() {
    return await this.workerStatusRepo.findWithError();
  }

  async getStaleWorkers(olderThanMinutes: number = 5) {
    return await this.workerStatusRepo.findStaleWorkers(olderThanMinutes);
  }
}
