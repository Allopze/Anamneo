import { Module } from '@nestjs/common';
import { DataBreachService } from './data-breach.service';
import { DataBreachController } from './data-breach.controller';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [AuditModule, MailModule],
  controllers: [DataBreachController],
  providers: [DataBreachService],
  exports: [DataBreachService],
})
export class DataBreachModule {}
