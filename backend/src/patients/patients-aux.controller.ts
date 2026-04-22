import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Res,
  StreamableFile,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { PatientsService } from './patients.service';
import { PatientsExportBundleService } from './patients-export-bundle.service';
import { PatientsPdfService } from './patients-pdf.service';
import { UpsertPatientProblemDto } from './dto/upsert-patient-problem.dto';
import { UpdatePatientProblemDto } from './dto/update-patient-problem.dto';
import { UpsertPatientTaskDto } from './dto/upsert-patient-task.dto';
import { UpdatePatientTaskStatusDto } from './dto/update-patient-task-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsAuxController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly patientsPdfService: PatientsPdfService,
    private readonly patientsExportBundleService: PatientsExportBundleService,
  ) {}

  @Put('problems/:problemId')
  @Roles('MEDICO', 'ASISTENTE')
  updateProblem(
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Body() dto: UpdatePatientProblemDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.updateProblem(user, problemId, dto);
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

  @Get(':id/export/bundle')
  @Roles('MEDICO', 'ASISTENTE')
  async exportPatientBundle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<StreamableFile> {
    const { buffer } = await this.patientsExportBundleService.generateBundle(id, user);
    return new StreamableFile(buffer, {
      type: 'application/zip',
      disposition: `attachment; filename="patient-bundle-${id}.zip"`,
      length: buffer.length,
    });
  }

  @Delete(':id')
  @Roles('MEDICO')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.patientsService.remove(id, user);
  }

}
