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
import { PatientsPdfService } from './patients-pdf.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreatePatientQuickDto } from './dto/create-patient-quick.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePatientAdminDto } from './dto/update-patient-admin.dto';
import { UpdatePatientHistoryDto } from './dto/update-patient-history.dto';
import { UpsertPatientProblemDto } from './dto/upsert-patient-problem.dto';
import { UpdatePatientProblemDto } from './dto/update-patient-problem.dto';
import { UpsertPatientTaskDto } from './dto/upsert-patient-task.dto';
import { UpdatePatientTaskStatusDto } from './dto/update-patient-task-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly patientsPdfService: PatientsPdfService,
  ) {}

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
  async exportCsv(
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ) {
    const csv = await this.patientsService.exportCsv(user);
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
    @Query('completenessStatus') completenessStatus?: string,
    @Query('edadMin') edadMin?: string,
    @Query('edadMax') edadMax?: string,
    @Query('clinicalSearch') clinicalSearch?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.patientsService.findAll(user, search, page || 1, limit || 20, {
      sexo,
      prevision,
      completenessStatus: completenessStatus as 'INCOMPLETA' | 'PENDIENTE_VERIFICACION' | 'VERIFICADA' | undefined,
      clinicalSearch,
      edadMin: edadMin ? parseInt(edadMin, 10) : undefined,
      edadMax: edadMax ? parseInt(edadMax, 10) : undefined,
      sortBy: sortBy as 'nombre' | 'edad' | 'createdAt' | 'updatedAt' | undefined,
      sortOrder: (sortOrder || 'asc') as 'asc' | 'desc',
    });
  }

  @Get('tasks')
  @Roles('MEDICO', 'ASISTENTE')
  findTasks(
    @CurrentUser() user: CurrentUserData,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('overdueOnly') overdueOnly?: string,
  ) {
    return this.patientsService.findTasks(user, {
      search,
      status,
      type,
      page: page || 1,
      limit: limit || 20,
      overdueOnly: overdueOnly === 'true',
    });
  }

  @Get(':id/admin-summary')
  @UseGuards(AdminGuard)
  getAdminSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.getAdminSummary(user, id);
  }

  @Get(':id/encounters')
  @Roles('MEDICO', 'ASISTENTE')
  findEncounterTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.patientsService.findEncounterTimeline(user, id, page || 1, limit || 10);
  }

  @Get(':id/clinical-summary')
  @Roles('MEDICO', 'ASISTENTE')
  getClinicalSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.getClinicalSummary(user, id);
  }

  @Get(':id')
  @Roles('MEDICO', 'ASISTENTE')
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

  @Post(':id/problems')
  @Roles('MEDICO', 'ASISTENTE')
  createProblem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertPatientProblemDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.createProblem(user, id, dto);
  }

  @Put('problems/:problemId')
  @Roles('MEDICO', 'ASISTENTE')
  updateProblem(
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Body() dto: UpdatePatientProblemDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.updateProblem(user, problemId, dto);
  }

  @Post(':id/tasks')
  @Roles('MEDICO', 'ASISTENTE')
  createTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertPatientTaskDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.createTask(user, id, dto);
  }

  @Put('tasks/:taskId')
  @Roles('MEDICO', 'ASISTENTE')
  updateTaskStatus(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdatePatientTaskStatusDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.updateTaskStatus(user, taskId, dto);
  }

  @Get(':id/export/pdf')
  @Roles('MEDICO', 'ASISTENTE')
  async exportLongitudinalPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ) {
    const buffer = await this.patientsPdfService.generateLongitudinalPdf(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="historial-${id}.pdf"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Delete(':id')
  @Roles('MEDICO')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.remove(id, user);
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
