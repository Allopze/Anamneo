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
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthTokens> {
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
    return this.generateTokens(user);
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

  async login(loginDto: LoginDto): Promise<AuthTokens> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.generateTokens(user);
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.active) {
        throw new UnauthorizedException('Usuario no encontrado o inactivo');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Token de refresco inválido');
    }
  }

  private generateTokens(user: { id: string; email: string; role: string }): AuthTokens {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return { accessToken, refreshToken };
  }
}

