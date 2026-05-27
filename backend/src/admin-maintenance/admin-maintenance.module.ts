import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AuthModule } from '../auth/auth.module';
import { AdminMaintenanceController } from './admin-maintenance.controller';
import { AdminMaintenanceService } from './admin-maintenance.service';

@Module({
  imports: [AttachmentsModule, AuthModule],
  controllers: [AdminMaintenanceController],
  providers: [AdminMaintenanceService],
})
export class AdminMaintenanceModule {}
