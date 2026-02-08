import { Prisma, PrismaClient } from '../generated/client';

export class WorkerStatusRepository {
  constructor(private prisma: PrismaClient) {}

  async upsert(data: {
    name: string;
    status: 'RUNNING' | 'STOPPED' | 'ERROR';
    metrics: Record<string, unknown>;
  }) {
    return await this.prisma.workerStatusRecord.upsert({
      where: { name: data.name },
      update: {
        status: data.status,
        lastSeen: new Date(),
        metrics: data.metrics as Prisma.InputJsonValue,
      },
      create: {
        name: data.name,
        status: data.status,
        lastSeen: new Date(),
        metrics: data.metrics as Prisma.InputJsonValue,
      },
    });
  }

  async findByName(name: string) {
    return await this.prisma.workerStatusRecord.findUnique({
      where: { name },
    });
  }

  async findAll() {
    return await this.prisma.workerStatusRecord.findMany({
      orderBy: { lastSeen: 'desc' },
    });
  }

  async findRunning() {
    return await this.prisma.workerStatusRecord.findMany({
      where: { status: 'RUNNING' },
      orderBy: { lastSeen: 'desc' },
    });
  }

  async findWithError() {
    return await this.prisma.workerStatusRecord.findMany({
      where: { status: 'ERROR' },
      orderBy: { lastSeen: 'desc' },
    });
  }

  async findStaleWorkers(olderThanMinutes: number = 5) {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - olderThanMinutes);

    return await this.prisma.workerStatusRecord.findMany({
      where: {
        lastSeen: {
          lt: cutoffDate,
        },
        status: 'RUNNING',
      },
    });
  }

  async updateStatus(name: string, status: 'RUNNING' | 'STOPPED' | 'ERROR') {
    return await this.prisma.workerStatusRecord.update({
      where: { name },
      data: { status, lastSeen: new Date() },
    });
  }

  async updateMetrics(name: string, metrics: Record<string, unknown>) {
    const worker = await this.findByName(name);
    if (!worker) return null;

    return await this.prisma.workerStatusRecord.update({
      where: { name },
      data: {
        metrics: {
          ...(worker.metrics as Record<string, unknown>),
          ...metrics,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async incrementEventsProcessed(name: string) {
    const worker = await this.findByName(name);
    if (!worker) return null;

    const metrics = worker.metrics as { eventsProcessed?: number };
    return await this.prisma.workerStatusRecord.update({
      where: { name },
      data: {
        metrics: {
          ...metrics,
          eventsProcessed: (metrics.eventsProcessed || 0) + 1,
        },
      },
    });
  }

  async incrementErrors(name: string) {
    const worker = await this.findByName(name);
    if (!worker) return null;

    const metrics = worker.metrics as { errors?: number };
    return await this.prisma.workerStatusRecord.update({
      where: { name },
      data: {
        metrics: {
          ...metrics,
          errors: (metrics.errors || 0) + 1,
        },
      },
    });
  }
}
