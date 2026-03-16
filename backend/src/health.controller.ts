import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  @Public()
  @SkipThrottle()
  async check() {
    const database = await this.prismaService.getDatabaseHealth();
    if (database.status !== 'ok') {
      throw new ServiceUnavailableException({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database,
      });
    }

    return { status: 'ok', timestamp: new Date().toISOString(), database };
  }

  @Get('sqlite')
  @Public()
  @SkipThrottle()
  async sqlite() {
    const database = await this.prismaService.getDatabaseHealth();
    if (database.status !== 'ok') {
      throw new ServiceUnavailableException({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database,
      });
    }

    const sqlite = await this.prismaService.getSqliteOperationalStatus();
    return {
      status: sqlite.status === 'warn' ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      database,
      sqlite,
    };
  }
}
