import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminMaintenanceService } from './admin-maintenance.service';
import { AdminMaintenanceDto } from './dto/admin-maintenance.dto';

@Controller('admin/maintenance')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGuard)
@Roles('ADMIN')
export class AdminMaintenanceController {
  constructor(private adminMaintenanceService: AdminMaintenanceService) {}

  @Post('purge-expired-password-reset-tokens')
  purgeExpiredPasswordResetTokens(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AdminMaintenanceDto,
  ) {
    return this.adminMaintenanceService.purgeExpiredPasswordResetTokens(user, dto);
  }

  @Post('purge-deleted-attachments')
  purgeDeletedAttachments(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AdminMaintenanceDto,
  ) {
    return this.adminMaintenanceService.purgeDeletedAttachments(user, dto);
  }

  @Post('rebuild-clinical-search')
  rebuildClinicalSearch(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AdminMaintenanceDto,
  ) {
    return this.adminMaintenanceService.rebuildClinicalSearch(user, dto);
  }

  @Post('audit-legacy-plaintext')
  auditLegacyPlaintext(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AdminMaintenanceDto,
  ) {
    return this.adminMaintenanceService.auditLegacyPlaintext(user, dto);
  }
}
