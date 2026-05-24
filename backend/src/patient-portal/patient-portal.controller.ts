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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { isMobileClient } from '../common/utils/mobile-client';
import { PatientPortalService } from './patient-portal.service';
import { PatientPortalAuthGuard } from './patient-portal-auth.guard';
import { CurrentPatientPortalUser } from './current-patient-portal-user.decorator';
import type { PatientPortalRequestUser } from './patient-portal.types';
import {
  PortalActivateDto,
  PortalDataRequestDto,
  PortalInviteDto,
  PortalLoginDto,
  PortalRequestPasswordResetDto,
  PortalResetPasswordDto,
} from './dto/patient-portal.dto';

function getCookieOptions(maxAge: number, isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

@Controller()
export class PatientPortalController {
  private readonly isProduction: boolean;
  private readonly accessMaxAge: number;
  private readonly refreshMaxAge: number;

  constructor(
    private readonly service: PatientPortalService,
    private readonly configService: ConfigService,
  ) {
    this.isProduction = configService.get<string>('NODE_ENV') === 'production';
    this.accessMaxAge = this.parseExpiry(configService.get<string>('JWT_EXPIRES_IN', '15m'));
    this.refreshMaxAge = this.parseExpiry(configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'));
  }

  @Post('admin/patients/:id/portal-invite')
  @UseGuards(JwtAuthGuard, AdminGuard)
  invite(
    @Param('id', ParseUUIDPipe) patientId: string,
    @Body() dto: PortalInviteDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.invitePatient(patientId, dto, user);
  }

  @Public()
  @Post('portal/auth/activate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async activate(@Body() dto: PortalActivateDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.service.activate(dto, this.getSessionContext(req));
    this.setPortalCookies(res, tokens);
    return { message: 'Portal activado', ...this.maybeMobileTokens(req, tokens) };
  }

  @Public()
  @Post('portal/auth/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: PortalLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.service.login(dto, this.getSessionContext(req));
    this.setPortalCookies(res, tokens);
    return { message: 'Inicio de sesión exitoso', ...this.maybeMobileTokens(req, tokens) };
  }

  @Public()
  @Post('portal/auth/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Body() body: { refreshToken?: string } = {},
    @Res({ passthrough: true }) res: Response,
  ) {
    // Web usa cookie httpOnly; móvil envía el refresh token en el body.
    const refreshToken = req.cookies?.patient_refresh_token ?? body?.refreshToken;
    if (!refreshToken) {
      this.clearPortalCookies(res);
      return { message: 'Sin sesión' };
    }
    const tokens = await this.service.refresh(refreshToken, this.getSessionContext(req));
    this.setPortalCookies(res, tokens);
    return { message: 'Tokens actualizados', ...this.maybeMobileTokens(req, tokens) };
  }

  @Post('portal/auth/logout')
  @UseGuards(PatientPortalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentPatientPortalUser() user: PatientPortalRequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.service.logout(user.id, user.sessionId);
    this.clearPortalCookies(res);
    return { message: 'Sesión cerrada' };
  }

  @Public()
  @Post('portal/auth/forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 2, ttl: 60000 } })
  requestReset(@Body() dto: PortalRequestPasswordResetDto, @Req() req: Request) {
    return this.service.requestPasswordReset(dto, this.getSessionContext(req));
  }

  @Public()
  @Post('portal/auth/reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() dto: PortalResetPasswordDto) {
    return this.service.resetPassword(dto);
  }

  @Get('portal/me')
  @UseGuards(PatientPortalAuthGuard)
  me(@CurrentPatientPortalUser() user: PatientPortalRequestUser) {
    return this.service.me(user);
  }

  @Get('portal/patient')
  @UseGuards(PatientPortalAuthGuard)
  getPatient(@CurrentPatientPortalUser() user: PatientPortalRequestUser) {
    return this.service.getPatient(user);
  }

  @Get('portal/encounters')
  @UseGuards(PatientPortalAuthGuard)
  listEncounters(@CurrentPatientPortalUser() user: PatientPortalRequestUser) {
    return this.service.listEncounters(user);
  }

  @Get('portal/encounters/:id')
  @UseGuards(PatientPortalAuthGuard)
  getEncounter(@CurrentPatientPortalUser() user: PatientPortalRequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getEncounter(user, id);
  }

  @Get('portal/encounters/:id/export/pdf')
  @UseGuards(PatientPortalAuthGuard)
  async exportEncounterPdf(
    @CurrentPatientPortalUser() user: PatientPortalRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.exportEncounterPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Post('portal/data-requests')
  @UseGuards(PatientPortalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  createDataRequest(
    @CurrentPatientPortalUser() user: PatientPortalRequestUser,
    @Body() dto: PortalDataRequestDto,
  ) {
    return this.service.createDataRequest(user, dto);
  }

  private setPortalCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('patient_access_token', tokens.accessToken, getCookieOptions(this.accessMaxAge, this.isProduction));
    res.cookie('patient_refresh_token', tokens.refreshToken, getCookieOptions(this.refreshMaxAge, this.isProduction));
  }

  private maybeMobileTokens(
    req: Request,
    tokens: { accessToken: string; refreshToken: string },
  ): { tokens?: { accessToken: string; refreshToken: string } } {
    return isMobileClient(req) ? { tokens } : {};
  }

  private clearPortalCookies(res: Response) {
    const opts = { httpOnly: true, secure: this.isProduction, sameSite: 'strict' as const, path: '/' };
    res.clearCookie('patient_access_token', opts);
    res.clearCookie('patient_refresh_token', opts);
  }

  private getSessionContext(req: Request) {
    return {
      userAgent: req.get('user-agent') ?? null,
      ipAddress: req.ip ?? null,
    };
  }

  private parseExpiry(value: string): number {
    const match = value.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 15 * 60 * 1000;
    const num = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return num * (multipliers[unit] || 60_000);
  }
}
