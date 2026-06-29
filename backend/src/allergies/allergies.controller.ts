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
import { AllergiesService } from './allergies.service';
import { CreateAllergyDto, UpdateAllergyDto } from './dto/allergy.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PatientNotBlockedGuard } from '../patient-data-rights/patient-not-blocked.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('allergies')
@UseGuards(JwtAuthGuard, RolesGuard, PatientNotBlockedGuard)
export class AllergiesController {
  constructor(private readonly allergiesService: AllergiesService) {}

  @Get('patient/:patientId')
  @Roles('MEDICO', 'ASISTENTE')
  findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.allergiesService.findByPatient(patientId, user);
  }

  @Post()
  @Roles('MEDICO')
  create(@Body() dto: CreateAllergyDto, @CurrentUser() user: CurrentUserData) {
    return this.allergiesService.create(dto, user);
  }

  @Put(':id')
  @Roles('MEDICO')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAllergyDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.allergiesService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('MEDICO')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.allergiesService.remove(id, user);
  }
}
