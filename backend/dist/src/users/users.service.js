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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = require("bcrypt");
const BCRYPT_ROUNDS = 12;
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async assertNotLeavingSystemWithoutAdmin(user, changes) {
        const willLoseAdminAccess = user.isAdmin
            && user.active
            && (changes.active === false || (changes.role !== undefined && changes.role !== 'ADMIN'));
        if (!willLoseAdminAccess) {
            return;
        }
        const remainingActiveAdmins = await this.prisma.user.count({
            where: {
                isAdmin: true,
                active: true,
                NOT: { id: user.id },
            },
        });
        if (remainingActiveAdmins === 0) {
            throw new common_1.ConflictException('Debe existir al menos un administrador activo en el sistema');
        }
    }
    async countUsers() {
        return this.prisma.user.count();
    }
    async countActiveAdmins() {
        return this.prisma.user.count({
            where: {
                isAdmin: true,
                active: true,
            },
        });
    }
    async create(createUserDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: createUserDto.email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('El correo electrónico ya está registrado');
        }
        const passwordHash = await bcrypt.hash(createUserDto.password, BCRYPT_ROUNDS);
        const role = (createUserDto.role ?? 'ASISTENTE');
        const isAdmin = role === 'ADMIN' ? true : (createUserDto.isAdmin ?? false);
        const allowUnassignedAssistant = !!createUserDto.allowUnassignedAssistant;
        if (role === 'ADMIN' && createUserDto.medicoId) {
            throw new common_1.ConflictException('Un administrador no puede tener medicoId asignado');
        }
        if (role === 'ASISTENTE' && !createUserDto.medicoId && !isAdmin && !allowUnassignedAssistant) {
            throw new common_1.ConflictException('Un asistente debe estar asignado a un médico');
        }
        if (role === 'MEDICO' && createUserDto.medicoId) {
            throw new common_1.ConflictException('Un médico no puede tener medicoId asignado');
        }
        if (createUserDto.medicoId) {
            const medico = await this.prisma.user.findUnique({ where: { id: createUserDto.medicoId } });
            if (!medico || medico.role !== 'MEDICO') {
                throw new common_1.NotFoundException('Médico asignado no encontrado');
            }
        }
        const user = await this.prisma.user.create({
            data: {
                email: createUserDto.email,
                passwordHash,
                nombre: createUserDto.nombre,
                role,
                medicoId: createUserDto.medicoId ?? null,
                isAdmin,
            },
            select: {
                id: true,
                email: true,
                nombre: true,
                role: true,
                medicoId: true,
                isAdmin: true,
                active: true,
                createdAt: true,
            },
        });
        return user;
    }
    async findAll() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                nombre: true,
                role: true,
                medicoId: true,
                isAdmin: true,
                active: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                nombre: true,
                role: true,
                medicoId: true,
                isAdmin: true,
                active: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return user;
    }
    async findByEmail(email) {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }
    async update(id, updateUserDto) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        const data = { ...updateUserDto };
        if (updateUserDto.password) {
            data.passwordHash = await bcrypt.hash(updateUserDto.password, BCRYPT_ROUNDS);
            delete data.password;
        }
        if (updateUserDto.email && updateUserDto.email !== user.email) {
            const existingUser = await this.prisma.user.findUnique({
                where: { email: updateUserDto.email },
            });
            if (existingUser) {
                throw new common_1.ConflictException('El correo electrónico ya está registrado');
            }
        }
        const nextRole = (updateUserDto.role ?? user.role);
        await this.assertNotLeavingSystemWithoutAdmin(user, {
            active: updateUserDto.active,
            role: nextRole,
        });
        if (nextRole === 'ADMIN') {
            data.isAdmin = true;
            data.medicoId = null;
        }
        else {
            data.isAdmin = false;
            if (nextRole === 'MEDICO') {
                data.medicoId = null;
            }
        }
        const nextMedicoId = data.medicoId !== undefined ? data.medicoId : user.medicoId;
        if (nextRole === 'ADMIN' && nextMedicoId) {
            throw new common_1.ConflictException('Un administrador no puede tener medicoId asignado');
        }
        if (nextRole === 'ASISTENTE' && !nextMedicoId) {
            throw new common_1.ConflictException('Un asistente debe estar asignado a un médico');
        }
        if (nextRole === 'MEDICO' && nextMedicoId) {
            throw new common_1.ConflictException('Un médico no puede tener medicoId asignado');
        }
        if (nextMedicoId) {
            const medico = await this.prisma.user.findUnique({ where: { id: nextMedicoId } });
            if (!medico || medico.role !== 'MEDICO') {
                throw new common_1.NotFoundException('Médico asignado no encontrado');
            }
        }
        return this.prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                email: true,
                nombre: true,
                role: true,
                medicoId: true,
                isAdmin: true,
                active: true,
                updatedAt: true,
            },
        });
    }
    async remove(id) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        await this.assertNotLeavingSystemWithoutAdmin(user, { active: false });
        return this.prisma.user.update({
            where: { id },
            data: { active: false },
            select: {
                id: true,
                email: true,
                active: true,
            },
        });
    }
    async updateProfile(id, data) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        if (data.email && data.email !== user.email) {
            const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
            if (existing) {
                throw new common_1.ConflictException('El correo electrónico ya está registrado');
            }
        }
        return this.prisma.user.update({
            where: { id },
            data: {
                ...(data.nombre !== undefined && { nombre: data.nombre }),
                ...(data.email !== undefined && { email: data.email }),
            },
            select: {
                id: true,
                email: true,
                nombre: true,
                role: true,
                medicoId: true,
                isAdmin: true,
            },
        });
    }
    async changePassword(id, currentPassword, newPassword) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) {
            throw new common_1.ConflictException('La contraseña actual es incorrecta');
        }
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await this.prisma.user.update({
            where: { id },
            data: { passwordHash },
        });
    }
    async resetPassword(id, temporaryPassword) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        const normalizedPassword = temporaryPassword.trim();
        if (normalizedPassword.length < 8) {
            throw new common_1.ConflictException('La contraseña temporal debe tener al menos 8 caracteres');
        }
        if (!/[A-Z]/.test(normalizedPassword) || !/[a-z]/.test(normalizedPassword) || !/[0-9]/.test(normalizedPassword)) {
            throw new common_1.ConflictException('La contraseña temporal debe contener mayúscula, minúscula y número');
        }
        const passwordHash = await bcrypt.hash(normalizedPassword, BCRYPT_ROUNDS);
        await this.prisma.user.update({
            where: { id },
            data: { passwordHash },
        });
        return { message: 'Contraseña restablecida correctamente' };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map