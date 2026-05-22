import { Controller, Get, Header, Logger, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { metricsRegistry, sqliteBackupAgeHours } from './metrics-registry';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsAccessGuard } from './metrics-access.guard';

@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly prismaService: PrismaService) {}

  // Exposición: el endpoint NO se expone via cloudflared en produccion. Prometheus
  // puede usar METRICS_SCRAPE_TOKEN; usuarios humanos siguen entrando como admin.
  @Get()
  @UseGuards(MetricsAccessGuard)
  @SkipThrottle()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    try {
      const sqlite = await this.prismaService.getSqliteOperationalStatus();
      const ageHours = sqlite?.backups?.latestBackupAgeHours;
      if (typeof ageHours === 'number') {
        sqliteBackupAgeHours.set(ageHours);
      }
    } catch (error) {
      this.logger.warn(`Could not refresh sqlite backup gauge: ${(error as Error).message}`);
    }

    return metricsRegistry.render();
  }
}
