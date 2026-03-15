import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from './resolve-database-url';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
      ...(process.env.DATABASE_URL
        ? { datasources: { db: { url: resolveDatabaseUrl(process.env.DATABASE_URL) } } }
        : {}),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    // Delete in order respecting relations
    await this.attachment.deleteMany();
    await this.conditionSuggestionLog.deleteMany();
    await this.encounterSection.deleteMany();
    await this.encounter.deleteMany();
    await this.patientHistory.deleteMany();
    await this.patient.deleteMany();
    await this.auditLog.deleteMany();
    await this.conditionCatalog.deleteMany();
    await this.user.deleteMany();
  }
}
