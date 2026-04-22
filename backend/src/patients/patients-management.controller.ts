import {
  Controller,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { MergePatientDto } from './dto/merge-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePatientAdminDto } from './dto/update-patient-admin.dto';
import { UpdatePatientHistoryDto } from './dto/update-patient-history.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsManagementController {
  constructor(
    private readonly patientsService: PatientsService,
  ) {}

  @Post(':id/merge')
  @Roles('MEDICO')
  mergeIntoTarget(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MergePatientDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.mergeIntoTarget(user, id, dto);
  }

  @Put(':id')
  @Roles('MEDICO')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.update(id, updatePatientDto, user);
  }

  @Put(':id/admin')
  @Roles('MEDICO', 'ASISTENTE')
  updateAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientAdminDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.updateAdminFields(user, id, dto);
  }

  @Post(':id/verify-demographics')
  @Roles('MEDICO')
  verifyDemographics(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.verifyDemographics(user, id);
  }

  @Put(':id/history')
  @Roles('MEDICO', 'ASISTENTE')
  updateHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateHistoryDto: UpdatePatientHistoryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.updateHistory(user, id, updateHistoryDto);
  }

  @Post(':id/restore')
  @Roles('MEDICO')
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.restore(id, user);
  }
}
