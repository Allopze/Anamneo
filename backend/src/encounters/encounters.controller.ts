import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { EncountersService } from './encounters.service';
import { EncountersPdfService } from './encounters-pdf.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { ParseSectionKeyPipe } from '../common/parse-section-key.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { EncounterStatus, SectionKey } from '../common/types';

@Controller('encounters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EncountersController {
  constructor(
    private readonly encountersService: EncountersService,
    private readonly encountersPdfService: EncountersPdfService,
  ) {}

  @Post('patient/:patientId')
  @Roles('MEDICO', 'ASISTENTE')
  create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() createDto: CreateEncounterDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.encountersService.create(patientId, createDto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('status') status?: EncounterStatus,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.encountersService.findAll(user, status, search, page || 1, limit || 15);
  }

  @Get('stats/dashboard')
  dashboard(@CurrentUser() user: CurrentUserData) {
    return this.encountersService.getDashboard(user);
  }

  @Get(':id/export/pdf')
  async exportPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.encountersPdfService.generatePdf(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ficha_clinica_${id.slice(0, 8)}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.encountersService.findById(id, user);
  }

  @Get('patient/:patientId')
  findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.encountersService.findByPatient(patientId, user);
  }

  @Put(':id/sections/:sectionKey')
  @Roles('MEDICO', 'ASISTENTE')
  updateSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sectionKey', ParseSectionKeyPipe) sectionKey: SectionKey,
    @Body() updateDto: UpdateSectionDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    // S4: Limit section data size to prevent abuse (100 KB)
    const serialized = JSON.stringify(updateDto.data);
    if (serialized.length > 100_000) {
      throw new BadRequestException('Los datos de la sección exceden el tamaño máximo permitido (100 KB)');
    }
    return this.encountersService.updateSection(id, sectionKey, updateDto, user);
  }

  @Post(':id/complete')
  @Roles('MEDICO')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.encountersService.complete(id, userId);
  }

  @Post(':id/reopen')
  @Roles('ADMIN')
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.encountersService.reopen(id, userId);
  }

  @Post(':id/cancel')
  @Roles('MEDICO')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.encountersService.cancel(id, userId);
  }
}
