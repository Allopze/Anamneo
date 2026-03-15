import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export declare class AuthService {
    private usersService;
    private jwtService;
    private configService;
    constructor(usersService: UsersService, jwtService: JwtService, configService: ConfigService);
    register(registerDto: RegisterDto): Promise<AuthTokens>;
    getBootstrapState(): Promise<{
        userCount: number;
        isEmpty: boolean;
        hasAdmin: boolean;
        registerableRoles: readonly ["MEDICO", "ASISTENTE"] | readonly ["ADMIN", "MEDICO", "ASISTENTE"];
    }>;
    validateUser(email: string, password: string): Promise<{
        id: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        nombre: string;
        role: string;
        medicoId: string | null;
        isAdmin: boolean;
        passwordHash: string;
    } | null>;
    login(loginDto: LoginDto): Promise<AuthTokens>;
    refreshTokens(refreshToken: string): Promise<AuthTokens>;
    private generateTokens;
}
