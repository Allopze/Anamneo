import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { PatientConsentsService } from './patient-consents.service';
import {
  GrantPatientDataConsentDto,
  RevokePatientDataConsentDto,
} from './dto/patient-consent.dto';

/**
 * Endpoints del consentimiento del TITULAR para tratamiento de datos
 * personales (Ley 21.719 Art 12). Por defecto admin/medico/asistente
 * autenticados pueden capturarlo y revocarlo (modo PRESENCIAL_TABLET).
 * El endpoint publico WEB_TITULAR vendra en una iteracion posterior.
 */
@Controller('patient-consents')
@UseGuards(JwtAuthGuard)
export class PatientConsentsController {
  constructor(private readonly service: PatientConsentsService) {}

  @Get('patient/:patientId')
  async listForPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.listForPatient(patientId, user);
  }

  @Post('grant')
  @HttpCode(HttpStatus.CREATED)
  async grant(
    @Body() dto: GrantPatientDataConsentDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    return this.service.grant(dto, user, {
      ip: req.ip,
      userAgent: req.headers['user-agent']?.toString(),
    });
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokePatientDataConsentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.revoke(id, dto.reason, user, dto.channel);
  }
}
