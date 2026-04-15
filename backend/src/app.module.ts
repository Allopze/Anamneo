import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { SentryModule } from '@sentry/nestjs/setup';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { EncountersModule } from './encounters/encounters.module';
import { ConditionsModule } from './conditions/conditions.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditModule } from './audit/audit.module';
import { TemplatesModule } from './templates/templates.module';
import { SettingsModule } from './settings/settings.module';
import { ConsentsModule } from './consents/consents.module';
import { AlertsModule } from './alerts/alerts.module';
import { Cie10Module } from './cie10/cie10.module';
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
            {
              name: 'short',
              ttl: 1000,
              limit: 3,
            },
            {
              name: 'medium',
              ttl: 10000,
              limit: 20,
            },
            {
              name: 'long',
              ttl: 60000,
              limit: 100,
            },
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
    AttachmentsModule,
    AuditModule,
    TemplatesModule,
    SettingsModule,
    ConsentsModule,
    AlertsModule,
    Cie10Module,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
