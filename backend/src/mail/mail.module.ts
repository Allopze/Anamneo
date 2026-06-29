import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SettingsModule } from '../settings/settings.module';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Module({
  imports: [ConfigModule, SettingsModule],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}