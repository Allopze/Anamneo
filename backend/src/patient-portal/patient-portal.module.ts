import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { EncountersModule } from '../encounters/encounters.module';
import { PatientPortalController } from './patient-portal.controller';
import { PatientPortalService } from './patient-portal.service';
import { PatientPortalAuthGuard } from './patient-portal-auth.guard';

@Module({
  imports: [
    AuditModule,
    MailModule,
    EncountersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m') as StringValue,
        },
      }),
    }),
  ],
  controllers: [PatientPortalController],
  providers: [PatientPortalService, PatientPortalAuthGuard],
  exports: [PatientPortalService],
})
export class PatientPortalModule {}
