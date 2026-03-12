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
exports.AttachmentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const medico_id_1 = require("../common/utils/medico-id");
const fs = require("fs/promises");
let AttachmentsService = class AttachmentsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(encounterId, file, user) {
        const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        const encounter = await this.prisma.encounter.findUnique({
            where: { id: encounterId },
            include: { patient: true },
        });
        if (!encounter) {
            throw new common_1.NotFoundException('Atención no encontrada');
        }
        if (encounter.patient.medicoId !== effectiveMedicoId) {
            throw new common_1.ForbiddenException('No tiene permisos para adjuntar archivos a esta atención');
        }
        const attachment = await this.prisma.attachment.create({
            data: {
                encounterId,
                filename: file.filename,
                originalName: file.originalname,
                mime: file.mimetype,
                size: file.size,
                storagePath: file.path,
                uploadedById: user.id,
            },
        });
        return {
            id: attachment.id,
            filename: attachment.originalName,
            mime: attachment.mime,
            size: attachment.size,
            uploadedAt: attachment.uploadedAt,
        };
    }
    async findByEncounter(encounterId, user) {
        const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        const encounter = await this.prisma.encounter.findUnique({
            where: { id: encounterId },
            include: { patient: true },
        });
        if (!encounter || encounter.patient.medicoId !== effectiveMedicoId) {
            throw new common_1.NotFoundException('Atención no encontrada');
        }
        return this.prisma.attachment.findMany({
            where: { encounterId },
            select: {
                id: true,
                originalName: true,
                mime: true,
                size: true,
                uploadedAt: true,
                uploadedBy: {
                    select: { nombre: true },
                },
            },
            orderBy: { uploadedAt: 'desc' },
        });
    }
    async getFile(id, user) {
        const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        const attachment = await this.prisma.attachment.findUnique({
            where: { id },
            include: {
                encounter: { include: { patient: true } },
            },
        });
        if (!attachment) {
            throw new common_1.NotFoundException('Archivo no encontrado');
        }
        if (attachment.encounter.patient.medicoId !== effectiveMedicoId) {
            throw new common_1.NotFoundException('Archivo no encontrado');
        }
        return {
            path: attachment.storagePath,
            filename: attachment.originalName,
            mime: attachment.mime,
        };
    }
    async remove(id, userId) {
        const attachment = await this.prisma.attachment.findUnique({
            where: { id },
            include: {
                encounter: { include: { patient: true } },
            },
        });
        if (!attachment) {
            throw new common_1.NotFoundException('Archivo no encontrado');
        }
        if (attachment.encounter.patient.medicoId !== userId) {
            throw new common_1.ForbiddenException('No tiene permisos para eliminar este archivo');
        }
        try {
            await fs.unlink(attachment.storagePath);
        }
        catch (error) {
        }
        await this.prisma.attachment.delete({ where: { id } });
        return { message: 'Archivo eliminado correctamente' };
    }
};
exports.AttachmentsService = AttachmentsService;
exports.AttachmentsService = AttachmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AttachmentsService);
//# sourceMappingURL=attachments.service.js.map