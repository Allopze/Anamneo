import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';
import { getEffectiveMedicoId } from '../common/utils/medico-id';

@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MEDICO', 'ASISTENTE')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    const medicoId = getEffectiveMedicoId(user);
    return this.templatesService.findByMedico(medicoId);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateTemplateDto) {
    const medicoId = getEffectiveMedicoId(user);
    return this.templatesService.create(medicoId, dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateTemplateDto,
  ) {
    const medicoId = getEffectiveMedicoId(user);
    return this.templatesService.update(id, medicoId, dto);
  }

  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserData) {
    const medicoId = getEffectiveMedicoId(user);
    return this.templatesService.delete(id, medicoId);
  }
}
