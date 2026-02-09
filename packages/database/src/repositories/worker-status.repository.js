import { Prisma, PrismaClient, WorkerStatusRecord } from '../generated/client';
export class WorkerStatusRepository {
  prisma;
  constructor(prisma) {
    this.prisma = prisma;
  }
  async upsert(data) {
    return await this.prisma.workerStatusRecord.upsert({
      where: { name: data.name },
      update: {
        status: data.status,
        lastSeen: new Date(),
        metrics: data.metrics,
      },
      create: {
        name: data.name,
        status: data.status,
        lastSeen: new Date(),
        metrics: data.metrics,
      },
    });
  }
  async findByName(name) {
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
  async findStaleWorkers(olderThanMinutes = 5) {
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
  async updateStatus(name, status) {
    return await this.prisma.workerStatusRecord.update({
      where: { name },
      data: { status, lastSeen: new Date() },
    });
  }
  async updateMetrics(name, metrics) {
    const worker = await this.findByName(name);
    if (!worker) return null;
    return await this.prisma.workerStatusRecord.update({
      where: { name },
      data: {
        metrics: {
          ...worker.metrics,
          ...metrics,
        },
      },
    });
  }
  async incrementEventsProcessed(name) {
    const worker = await this.findByName(name);
    if (!worker) return null;
    const metrics = worker.metrics;
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
  async incrementErrors(name) {
    const worker = await this.findByName(name);
    if (!worker) return null;
    const metrics = worker.metrics;
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
