import { Controller, Get, Header, Logger, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  metricsRegistry,
  postgresBackupAgeHours,
  postgresConnectionsTotal,
  postgresDatabaseSizeBytes,
  postgresWaitingLocksTotal,
} from './metrics-registry';
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
      const database = await this.prismaService.getDatabaseOperationalStatus();
      const ageHours = database?.backups?.latestBackupAgeHours;
      if (typeof ageHours === 'number') {
        postgresBackupAgeHours.set(ageHours);
      }
      postgresConnectionsTotal.set(database.connections.total, { state: 'total' });
      postgresConnectionsTotal.set(database.connections.active, { state: 'active' });
      postgresConnectionsTotal.set(database.connections.idle, { state: 'idle' });
      postgresWaitingLocksTotal.set(database.locks.waiting);
      if (typeof database.sizeBytes === 'number') {
        postgresDatabaseSizeBytes.set(database.sizeBytes);
      }
    } catch (error) {
      this.logger.warn(`Could not refresh postgres database gauges: ${(error as Error).message}`);
    }

    return metricsRegistry.render();
  }
}
