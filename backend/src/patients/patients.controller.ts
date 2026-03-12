import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreatePatientQuickDto } from './dto/create-patient-quick.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePatientAdminDto } from './dto/update-patient-admin.dto';
import { UpdatePatientHistoryDto } from './dto/update-patient-history.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles('MEDICO')
  create(
    @Body() createPatientDto: CreatePatientDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.patientsService.create(createPatientDto, userId);
  }

  @Post('quick')
  @Roles('MEDICO', 'ASISTENTE')
  createQuick(
    @Body() createPatientDto: CreatePatientQuickDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.createQuick(createPatientDto, user);
  }

  @Get('export/csv')
  @UseGuards(AdminGuard)
  async exportCsv(@Res() res: Response) {
    const csv = await this.patientsService.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=pacientes_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sexo') sexo?: string,
    @Query('prevision') prevision?: string,
    @Query('edadMin') edadMin?: string,
    @Query('edadMax') edadMax?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.patientsService.findAll(user, search, page || 1, limit || 20, {
      sexo, prevision,
      edadMin: edadMin ? parseInt(edadMin, 10) : undefined,
      edadMax: edadMax ? parseInt(edadMax, 10) : undefined,
      sortBy: sortBy as 'nombre' | 'edad' | 'createdAt' | undefined,
      sortOrder: (sortOrder || 'asc') as 'asc' | 'desc',
    });
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.findById(user, id);
  }

  @Put(':id')
  @Roles('MEDICO')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.patientsService.update(id, updatePatientDto, userId);
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

  @Put(':id/history')
  updateHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateHistoryDto: UpdatePatientHistoryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.updateHistory(user, id, updateHistoryDto);
  }

  @Delete(':id')
  @Roles('MEDICO')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.patientsService.remove(id, userId);
  }
}
