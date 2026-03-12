import { Controller, Post, Body, HttpCode, HttpStatus, Get, Patch, UseGuards, Res, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

// Cookie configuration helper
function getCookieOptions(maxAge: number, isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;
  private readonly accessMaxAge: number;
  private readonly refreshMaxAge: number;

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {
    this.isProduction = configService.get<string>('NODE_ENV') === 'production';
    // Parse expiry strings to milliseconds for cookie maxAge
    this.accessMaxAge = this.parseExpiry(configService.get<string>('JWT_EXPIRES_IN', '15m'));
    this.refreshMaxAge = this.parseExpiry(configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'));
  }

  private parseExpiry(value: string): number {
    const match = value.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 15 * 60 * 1000; // default 15m
    const num = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return num * (multipliers[unit] || 60_000);
  }

  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('access_token', tokens.accessToken, getCookieOptions(this.accessMaxAge, this.isProduction));
    res.cookie('refresh_token', tokens.refreshToken, getCookieOptions(this.refreshMaxAge, this.isProduction));
  }

  private clearAuthCookies(res: Response) {
    const opts = { httpOnly: true, secure: this.isProduction, sameSite: 'strict' as const, path: '/' };
    res.clearCookie('access_token', opts);
    res.clearCookie('refresh_token', opts);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: CurrentUserData) {
    return user;
  }

  @Get('bootstrap')
  async bootstrap() {
    return this.authService.getBootstrapState();
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(registerDto);
    this.setAuthCookies(res, result);
    return { message: 'Registro exitoso' };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(loginDto);
    this.setAuthCookies(res, tokens);
    return { message: 'Inicio de sesión exitoso' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Res({ passthrough: true }) res: Response, @Body() body?: RefreshTokenDto) {
    // Try cookie first, fallback to body (backward compat)
    const rawCookies = (res.req as any)?.cookies;
    const refreshToken = rawCookies?.refresh_token || body?.refreshToken;
    if (!refreshToken) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Token de refresco no proporcionado');
    }
    const tokens = await this.authService.refreshTokens(refreshToken);
    this.setAuthCookies(res, tokens);
    return { message: 'Tokens actualizados' };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@CurrentUser() user: CurrentUserData, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async changePassword(@CurrentUser() user: CurrentUserData, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { message: 'Contraseña actualizada correctamente' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookies(res);
    return { message: 'Sesión cerrada' };
  }
}
