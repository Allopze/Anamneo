import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ConsentsService } from './consents.service';
import { CreateConsentDto, RevokeConsentDto } from './dto/consent.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('consents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Post()
  @Roles('MEDICO', 'ASISTENTE')
  create(@Body() dto: CreateConsentDto, @CurrentUser() user: CurrentUserData) {
    return this.consentsService.create(dto, user);
  }

  @Get('patient/:patientId')
  @Roles('MEDICO', 'ASISTENTE')
  findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.consentsService.findByPatient(patientId, user);
  }

  @Post(':id/revoke')
  @Roles('MEDICO')
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeConsentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.consentsService.revoke(id, dto, user);
  }
}
