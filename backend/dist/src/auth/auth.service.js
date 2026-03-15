"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = require("bcrypt");
const users_service_1 = require("../users/users.service");
let AuthService = class AuthService {
    constructor(usersService, jwtService, configService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async register(registerDto) {
        const existingUser = await this.usersService.findByEmail(registerDto.email);
        if (existingUser) {
            throw new common_1.ConflictException('Ya existe un usuario con este email');
        }
        const requestedRole = registerDto.role || 'ASISTENTE';
        if (requestedRole === 'ADMIN') {
            const adminCount = await this.usersService.countActiveAdmins();
            if (adminCount > 0) {
                throw new common_1.ConflictException('Ya existe un administrador registrado. Use MEDICO o ASISTENTE');
            }
        }
        const user = await this.usersService.create({
            email: registerDto.email,
            password: registerDto.password,
            nombre: registerDto.nombre,
            role: requestedRole,
            ...(requestedRole === 'ASISTENTE' ? { allowUnassignedAssistant: true } : {}),
        });
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
                ? ['MEDICO', 'ASISTENTE']
                : ['ADMIN', 'MEDICO', 'ASISTENTE'],
        };
    }
    async validateUser(email, password) {
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
    async login(loginDto) {
        const user = await this.validateUser(loginDto.email, loginDto.password);
        if (!user) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        return this.generateTokens(user);
    }
    async refreshTokens(refreshToken) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
            });
            const user = await this.usersService.findById(payload.sub);
            if (!user || !user.active) {
                throw new common_1.UnauthorizedException('Usuario no encontrado o inactivo');
            }
            return this.generateTokens(user);
        }
        catch {
            throw new common_1.UnauthorizedException('Token de refresco inválido');
        }
    }
    generateTokens(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };
        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
        });
        return { accessToken, refreshToken };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map