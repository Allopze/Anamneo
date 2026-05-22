import { Controller, Get, Header, Logger, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { metricsRegistry, sqliteBackupAgeHours } from './metrics-registry';
import { PrismaService } from '../prisma/prisma.service';

@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly prismaService: PrismaService) {}

  // Exposición: el endpoint NO se expone via cloudflared en producción. Se asume
  // que el sidecar/agente Prometheus corre en la misma red local que el backend
  // (configuración del operador). Como defensa adicional sigue protegido con
  // JwtAuthGuard + AdminGuard salvo que se exporte como Public con basic-auth a
  // nivel de proxy. Por ahora mantenemos admin-only para single-clinic.
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
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
