import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { IsBooleanString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { PatientsRegulatoryExportService } from './patients-regulatory-export.service';
import {
  PatientsRegulatoryPurgeService,
} from './patients-regulatory-purge.service';

class RegulatoryPurgeDto {
  @IsString()
  @IsIn(['PURGE-REGULATORY'], { message: 'confirmation debe ser "PURGE-REGULATORY"' })
  confirmation!: string;

  @IsString()
  @MinLength(16, { message: 'La justificación debe tener al menos 16 caracteres' })
  @MaxLength(1000)
  justification!: string;

  @IsOptional()
  @IsBooleanString({ message: 'bypassRetention debe ser "true" o "false"' })
  bypassRetention?: string;
}

/**
 * Endpoints regulatorios bajo Ley 19.628 / Ley 21.719. Admin-only.
 */
@Controller('patients')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PatientsRegulatoryController {
  constructor(
    private readonly exportService: PatientsRegulatoryExportService,
    private readonly purgeService: PatientsRegulatoryPurgeService,
  ) {}

  @Get(':id/export/regulatory')
  async exportRegulatory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.exportService.buildZip(id, user);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Delete(':id/purge')
  @HttpCode(HttpStatus.OK)
  async purgeRegulatory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RegulatoryPurgeDto,
  ) {
    return this.purgeService.purgePatient(id, user, {
      confirmation: dto.confirmation,
      justification: dto.justification,
      bypassRetention: dto.bypassRetention === 'true',
    });
  }
}
