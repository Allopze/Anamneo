import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { LegalService } from './legal.service';
import { CreateLegalDocumentDraftDto, UpdateLegalDocumentDraftDto } from './dto/legal-document.dto';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('documents/current')
  getCurrentDocuments() {
    return this.legalService.getCurrentPublishedDocuments();
  }

  @Get('documents/:type/current')
  getCurrentDocument(@Param('type') type: string) {
    return this.legalService.getCurrentPublishedDocument(type);
  }

  @Get('acceptances/me')
  @UseGuards(JwtAuthGuard)
  listMyAcceptances(@CurrentUser() user: CurrentUserData) {
    return this.legalService.listUserAcceptances(user.id);
  }

  @Get('admin/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listAdminDocuments() {
    return this.legalService.listAdminDocuments();
  }

  @Post('admin/documents/draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  createDraft(@CurrentUser() user: CurrentUserData, @Body() dto: CreateLegalDocumentDraftDto) {
    return this.legalService.createDraft(user, dto);
  }

  @Patch('admin/documents/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateDraft(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateLegalDocumentDraftDto,
  ) {
    return this.legalService.updateDraft(user, id, dto);
  }

  @Post('admin/documents/:id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  publishDraft(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.legalService.publishDraft(user, id);
  }
}
