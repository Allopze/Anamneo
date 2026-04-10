import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/alert.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @Roles('MEDICO')
  create(@Body() dto: CreateAlertDto, @CurrentUser() user: CurrentUserData) {
    return this.alertsService.create(dto, user);
  }

  @Get('unacknowledged-count')
  @Roles('MEDICO', 'ASISTENTE')
  async countUnacknowledged(@CurrentUser() user: CurrentUserData) {
    const count = await this.alertsService.countUnacknowledged(user);
    return { count };
  }

  @Get('unacknowledged')
  @Roles('MEDICO', 'ASISTENTE')
  async findRecentUnacknowledged(@CurrentUser() user: CurrentUserData) {
    const alerts = await this.alertsService.findRecentUnacknowledged(user);
    return { data: alerts };
  }

  @Get('patient/:patientId')
  @Roles('MEDICO', 'ASISTENTE')
  findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: CurrentUserData,
    @Query('includeAcknowledged') includeAcknowledged?: string,
  ) {
    return this.alertsService.findByPatient(patientId, user, includeAcknowledged === 'true');
  }

  @Post(':id/acknowledge')
  @Roles('MEDICO')
  acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.alertsService.acknowledge(id, user);
  }
}
