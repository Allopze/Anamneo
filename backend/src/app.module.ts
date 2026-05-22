import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import { SentryModule } from '@sentry/nestjs/setup';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { EncountersModule } from './encounters/encounters.module';
import { ConditionsModule } from './conditions/conditions.module';
import { MedicationsModule } from './medications/medications.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditModule } from './audit/audit.module';
import { TemplatesModule } from './templates/templates.module';
import { SettingsModule } from './settings/settings.module';
import { ConsentsModule } from './consents/consents.module';
import { AlertsModule } from './alerts/alerts.module';
import { Cie10Module } from './cie10/cie10.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { LegalModule } from './legal/legal.module';
import { MetricsModule } from './metrics/metrics.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    SentryModule.forRoot(),

    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),

    // Rate limiting (relaxed in test mode to avoid flaky E2E tests)
    ThrottlerModule.forRoot(
      process.env.NODE_ENV === 'test'
        ? [
            { name: 'short', ttl: 1000, limit: 100 },
            { name: 'medium', ttl: 10000, limit: 500 },
            { name: 'long', ttl: 60000, limit: 2000 },
          ]
        : [
            // Limites globales por sesion/usuario (o por IP si no hay sesion).
            // Suficientes para uso clinico real con autoguardado y dashboards.
            // Endpoints sensibles (login, register, 2fa/verify) tienen @Throttle
            // mas restrictivo en auth.controller.ts.
            { name: 'short', ttl: 1000, limit: 20 },
            { name: 'medium', ttl: 10000, limit: 120 },
            { name: 'long', ttl: 60000, limit: 600 },
          ],
    ),

    // Database
    PrismaModule,

    // Features
    AuthModule,
    UsersModule,
    PatientsModule,
    EncountersModule,
    ConditionsModule,
    MedicationsModule,
    AttachmentsModule,
    AuditModule,
    TemplatesModule,
    SettingsModule,
    ConsentsModule,
    AlertsModule,
    Cie10Module,
    AnalyticsModule,
    LegalModule,
    MetricsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: UserThrottlerGuard,
    },
  ],
})
export class AppModule {}
