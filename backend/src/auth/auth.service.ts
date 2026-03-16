import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from './dto/register.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  rv?: number;
  sid?: string;
  sv?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
  sessionId?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto, sessionContext?: SessionContext): Promise<AuthTokens> {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con este email');
    }

    const requestedRole: Role = registerDto.role || 'ASISTENTE';

    if (requestedRole === 'ADMIN') {
      const adminCount = await this.usersService.countActiveAdmins();
      if (adminCount > 0) {
        throw new ConflictException('Ya existe un administrador registrado. Use MEDICO o ASISTENTE');
      }
    }

    // Create user (users service handles password hashing)
    const user = await this.usersService.create({
      email: registerDto.email,
      password: registerDto.password,
      nombre: registerDto.nombre,
      role: requestedRole,
      ...(requestedRole === 'ASISTENTE' ? { allowUnassignedAssistant: true } : {}),
    });

    // Generate and return tokens
    return this.issueTokens(user, sessionContext);
  }

  async getBootstrapState() {
    const userCount = await this.usersService.countUsers();
    const adminCount = await this.usersService.countActiveAdmins();
    const hasAdmin = adminCount > 0;
    return {
      userCount,
      isEmpty: userCount === 0,
      hasAdmin,
      registerableRoles: hasAdmin
        ? (['MEDICO', 'ASISTENTE'] as const)
        : (['ADMIN', 'MEDICO', 'ASISTENTE'] as const),
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.active) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(loginDto: LoginDto, sessionContext?: SessionContext): Promise<AuthTokens> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.issueTokens(user, sessionContext);
  }

  async refreshTokens(refreshToken: string, sessionContext?: SessionContext): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findAuthById(payload.sub);
      if (!user || !user.active) {
        throw new UnauthorizedException('Usuario no encontrado o inactivo');
      }

      if (typeof payload.rv !== 'number' || payload.rv !== user.refreshTokenVersion) {
        throw new UnauthorizedException('Token de refresco inválido');
      }

      if (typeof payload.sid !== 'string' || typeof payload.sv !== 'number') {
        throw new UnauthorizedException('Token de refresco inválido');
      }

      const session = await this.usersService.findActiveSessionById(payload.sid);
      if (!session || session.userId !== user.id || session.tokenVersion !== payload.sv) {
        throw new UnauthorizedException('Token de refresco inválido');
      }

      return this.issueTokens(user, {
        ...sessionContext,
        sessionId: session.id,
      });
    } catch {
      throw new UnauthorizedException('Token de refresco inválido');
    }
  }

  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findAuthById(payload.sub);
      if (!user || !user.active) {
        return;
      }

      if (typeof payload.sid === 'string') {
        await this.usersService.revokeSessionById(payload.sid);
      } else {
        await this.usersService.rotateRefreshTokenVersion(user.id);
      }
    } catch {
      // Ignore invalid/expired tokens on logout.
    }
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.usersService.rotateRefreshTokenVersion(userId);
    await this.usersService.revokeAllSessionsForUser(userId);
  }

  private async issueTokens(
    user: { id: string; email: string; role: string },
    sessionContext?: SessionContext,
  ): Promise<AuthTokens> {
    const authUser = await this.usersService.findAuthById(user.id);
    if (!authUser || !authUser.active) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    const session = sessionContext?.sessionId
      ? await this.usersService.rotateSessionTokenVersion(sessionContext.sessionId, sessionContext)
      : await this.usersService.createSession(authUser.id, sessionContext);

    if (!session || session.userId !== authUser.id) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const payload: JwtPayload = {
      sub: authUser.id,
      email: user.email,
      role: user.role,
    };

    const refreshPayload: JwtPayload = {
      ...payload,
      rv: authUser.refreshTokenVersion,
      sid: session.id,
      sv: session.tokenVersion,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return { accessToken, refreshToken };
  }
}

