import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
export declare class AuthController {
    private authService;
    private usersService;
    private configService;
    private readonly isProduction;
    private readonly accessMaxAge;
    private readonly refreshMaxAge;
    constructor(authService: AuthService, usersService: UsersService, configService: ConfigService);
    private parseExpiry;
    private setAuthCookies;
    private clearAuthCookies;
    me(user: CurrentUserData): CurrentUserData;
    bootstrap(): Promise<{
        userCount: number;
        isEmpty: boolean;
    }>;
    register(registerDto: RegisterDto, res: Response): Promise<{
        message: string;
    }>;
    login(loginDto: LoginDto, res: Response): Promise<{
        message: string;
    }>;
    refresh(res: Response, body?: RefreshTokenDto): Promise<{
        message: string;
    }>;
    updateProfile(user: CurrentUserData, dto: UpdateProfileDto): Promise<{
        id: string;
        email: string;
        nombre: string;
        role: string;
        medicoId: string | null;
        isAdmin: boolean;
    }>;
    changePassword(user: CurrentUserData, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    logout(res: Response): Promise<{
        message: string;
    }>;
}
