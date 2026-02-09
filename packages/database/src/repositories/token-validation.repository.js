import { PrismaClient, TokenValidationRecord } from '../generated/client';
export class TokenValidationRepository {
  prisma;
  constructor(prisma) {
    this.prisma = prisma;
  }
  async create(data) {
    return await this.prisma.tokenValidationRecord.create({
      data: {
        ...data,
        validatedAt: data.validatedAt ?? new Date(),
      },
    });
  }
  async findById(id) {
    return await this.prisma.tokenValidationRecord.findUnique({
      where: { id },
    });
  }
  async findByToken(token, limit = 20) {
    return await this.prisma.tokenValidationRecord.findMany({
      where: { token },
      orderBy: { validatedAt: 'desc' },
      take: limit,
    });
  }
  async findLatestByToken(token) {
    const results = await this.findByToken(token, 1);
    return results.length > 0 ? results[0] : null;
  }
  async findRecent(limit = 50) {
    return await this.prisma.tokenValidationRecord.findMany({
      orderBy: { validatedAt: 'desc' },
      take: limit,
    });
  }
  async findHighConfidence(minConfidence, limit = 50) {
    return await this.prisma.tokenValidationRecord.findMany({
      where: {
        confidence: {
          gte: minConfidence,
        },
      },
      orderBy: { validatedAt: 'desc' },
      take: limit,
    });
  }
  async findRenouncedTokens(limit = 50) {
    return await this.prisma.tokenValidationRecord.findMany({
      where: {
        isRenounced: true,
      },
      orderBy: { validatedAt: 'desc' },
      take: limit,
    });
  }
  async findBurnedTokens(limit = 50) {
    return await this.prisma.tokenValidationRecord.findMany({
      where: {
        isBurned: true,
      },
      orderBy: { validatedAt: 'desc' },
      take: limit,
    });
  }
  async findLockedTokens(limit = 50) {
    return await this.prisma.tokenValidationRecord.findMany({
      where: {
        isLocked: true,
      },
      orderBy: { validatedAt: 'desc' },
      take: limit,
    });
  }
  async upsert(data) {
    // Find the most recent validation for this token
    const existing = await this.findLatestByToken(data.token);
    if (existing) {
      // Update existing if newer
      return await this.prisma.tokenValidationRecord.update({
        where: { id: existing.id },
        data: {
          ...data,
          validatedAt: data.validatedAt ?? new Date(),
        },
      });
    }
    // Create new
    return await this.create(data);
  }
  async deleteOlderThan(days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return await this.prisma.tokenValidationRecord.deleteMany({
      where: {
        validatedAt: {
          lt: cutoffDate,
        },
      },
    });
  }
  async getTokenStats(token) {
    const validations = await this.findByToken(token, 100);
    if (validations.length === 0) {
      return {
        totalValidations: 0,
        latestValidation: null,
        avgConfidence: 0,
        renouncedCount: 0,
        burnedCount: 0,
        lockedCount: 0,
      };
    }
    const avgConfidence =
      validations.reduce((sum, v) => sum + Number(v.confidence), 0) / validations.length;
    return {
      totalValidations: validations.length,
      latestValidation: validations[0] || null,
      avgConfidence,
      renouncedCount: validations.filter((v) => v.isRenounced).length,
      burnedCount: validations.filter((v) => v.isBurned).length,
      lockedCount: validations.filter((v) => v.isLocked).length,
    };
  }
}
