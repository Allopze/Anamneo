import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { PatientDataRightsService } from './patient-data-rights.service';
import {
  AdminUpdateDataRequestDto,
  CreateDataRequestExportLinkDto,
  DownloadDataRequestExportDto,
  ExtendDataRequestDto,
  PublicDataRequestDto,
  RevokeDataRequestExportLinkDto,
  ResolveDataRequestDto,
} from './dto/patient-data-rights.dto';

@Controller()
export class PatientDataRightsController {
  constructor(private readonly service: PatientDataRightsService) {}

  // ---------- Ruta publica para el titular (Ley 21.719 Art 4-11) ----------
  // /api/public/derechos
  @Public()
  @Post('public/derechos')
  @HttpCode(HttpStatus.CREATED)
  // Rate-limit estricto: 5 solicitudes / 10 min por IP
  @Throttle({ default: { limit: 5, ttl: 10 * 60 * 1000 } })
  async submitPublic(@Body() dto: PublicDataRequestDto, @Req() req: Request) {
    return this.service.createFromPublic(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent']?.toString(),
    });
  }

  @Public()
  @Post('public/data-request-downloads/:token/download')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 10 * 60 * 1000 } })
  async downloadPublic(
    @Param('token') token: string,
    @Body() dto: DownloadDataRequestExportDto,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.downloadExport(token, dto);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  // ---------- Rutas admin ----------
  // /api/admin/data-requests
  @Get('admin/data-requests')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async list(
    @Query('status') status: string | undefined,
    @Query('requestType') requestType: string | undefined,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.list({ status, requestType }, user);
  }

  @Get('admin/data-requests/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserData) {
    return this.service.getById(id, user);
  }

  @Patch('admin/data-requests/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateDataRequestDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.adminUpdate(id, dto, user);
  }

  @Post('admin/data-requests/:id/extend')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async extend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendDataRequestDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.extend(id, dto, user);
  }

  @Post('admin/data-requests/:id/resolve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDataRequestDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.resolve(id, dto, user);
  }

  @Post('admin/data-requests/:id/export-link')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async createExportLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDataRequestExportLinkDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.createExportLink(id, dto, user);
  }

  @Post('admin/data-request-downloads/:id/revoke')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async revokeExportLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeDataRequestExportLinkDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.revokeExportLink(id, dto.reason, user);
  }
}
