import { Controller, Get, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/decorators/public.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AdminGuard } from './common/guards/admin.guard';
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
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, AdminGuard)
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
