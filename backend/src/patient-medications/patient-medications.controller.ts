import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PatientMedicationsService } from './patient-medications.service';
import {
  CreatePatientMedicationDto,
  UpdatePatientMedicationDto,
} from './dto/patient-medication.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PatientNotBlockedGuard } from '../patient-data-rights/patient-not-blocked.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('patient-medications')
@UseGuards(JwtAuthGuard, RolesGuard, PatientNotBlockedGuard)
export class PatientMedicationsController {
  constructor(private readonly service: PatientMedicationsService) {}

  @Get('patient/:patientId')
  @Roles('MEDICO', 'ASISTENTE')
  findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.findByPatient(patientId, user);
  }

  @Post()
  @Roles('MEDICO')
  create(@Body() dto: CreatePatientMedicationDto, @CurrentUser() user: CurrentUserData) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles('MEDICO')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientMedicationDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('MEDICO')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.remove(id, user);
  }
}
