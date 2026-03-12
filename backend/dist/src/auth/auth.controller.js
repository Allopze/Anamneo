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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const register_dto_1 = require("./dto/register.dto");
const refresh_token_dto_1 = require("./dto/refresh-token.dto");
const update_profile_dto_1 = require("./dto/update-profile.dto");
const change_password_dto_1 = require("./dto/change-password.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const users_service_1 = require("../users/users.service");
const config_1 = require("@nestjs/config");
function getCookieOptions(maxAge, isProduction) {
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/',
        maxAge,
    };
}
let AuthController = class AuthController {
    constructor(authService, usersService, configService) {
        this.authService = authService;
        this.usersService = usersService;
        this.configService = configService;
        this.isProduction = configService.get('NODE_ENV') === 'production';
        this.accessMaxAge = this.parseExpiry(configService.get('JWT_EXPIRES_IN', '15m'));
        this.refreshMaxAge = this.parseExpiry(configService.get('JWT_REFRESH_EXPIRES_IN', '7d'));
    }
    parseExpiry(value) {
        const match = value.match(/^(\d+)(s|m|h|d)$/);
        if (!match)
            return 15 * 60 * 1000;
        const num = parseInt(match[1], 10);
        const unit = match[2];
        const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
        return num * (multipliers[unit] || 60_000);
    }
    setAuthCookies(res, tokens) {
        res.cookie('access_token', tokens.accessToken, getCookieOptions(this.accessMaxAge, this.isProduction));
        res.cookie('refresh_token', tokens.refreshToken, getCookieOptions(this.refreshMaxAge, this.isProduction));
    }
    clearAuthCookies(res) {
        const opts = { httpOnly: true, secure: this.isProduction, sameSite: 'strict', path: '/' };
        res.clearCookie('access_token', opts);
        res.clearCookie('refresh_token', opts);
    }
    me(user) {
        return user;
    }
    async bootstrap() {
        return this.authService.getBootstrapState();
    }
    async register(registerDto, res) {
        const result = await this.authService.register(registerDto);
        this.setAuthCookies(res, result);
        return { message: 'Registro exitoso' };
    }
    async login(loginDto, res) {
        const tokens = await this.authService.login(loginDto);
        this.setAuthCookies(res, tokens);
        return { message: 'Inicio de sesión exitoso' };
    }
    async refresh(res, body) {
        const rawCookies = res.req?.cookies;
        const refreshToken = rawCookies?.refresh_token || body?.refreshToken;
        if (!refreshToken) {
            this.clearAuthCookies(res);
            throw new common_1.UnauthorizedException('Token de refresco no proporcionado');
        }
        const tokens = await this.authService.refreshTokens(refreshToken);
        this.setAuthCookies(res, tokens);
        return { message: 'Tokens actualizados' };
    }
    async updateProfile(user, dto) {
        return this.usersService.updateProfile(user.id, dto);
    }
    async changePassword(user, dto) {
        await this.usersService.changePassword(user.id, dto.currentPassword, dto.newPassword);
        return { message: 'Contraseña actualizada correctamente' };
    }
    async logout(res) {
        this.clearAuthCookies(res);
        return { message: 'Sesión cerrada' };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('bootstrap'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "bootstrap", null);
__decorate([
    (0, common_1.Post)('register'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, throttler_1.Throttle)({ short: { limit: 3, ttl: 60000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)({ short: { limit: 5, ttl: 60000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, refresh_token_dto_1.RefreshTokenDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Patch)('profile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_profile_dto_1.UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Post)('change-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, change_password_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        users_service_1.UsersService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map