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
exports.TemplatesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TemplatesService = class TemplatesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByMedico(medicoId) {
        return this.prisma.textTemplate.findMany({
            where: { medicoId },
            orderBy: { updatedAt: 'desc' },
        });
    }
    async create(medicoId, data) {
        return this.prisma.textTemplate.create({
            data: { ...data, category: data.category || 'GENERAL', medicoId },
        });
    }
    async update(id, medicoId, data) {
        const template = await this.prisma.textTemplate.findUnique({ where: { id } });
        if (!template)
            throw new common_1.NotFoundException('Plantilla no encontrada');
        if (template.medicoId !== medicoId)
            throw new common_1.ForbiddenException('No tiene permisos para editar esta plantilla');
        return this.prisma.textTemplate.update({
            where: { id },
            data,
        });
    }
    async delete(id, medicoId) {
        const template = await this.prisma.textTemplate.findUnique({ where: { id } });
        if (!template)
            throw new common_1.NotFoundException('Plantilla no encontrada');
        if (template.medicoId !== medicoId)
            throw new common_1.ForbiddenException('No tiene permisos para eliminar esta plantilla');
        return this.prisma.textTemplate.delete({ where: { id } });
    }
};
exports.TemplatesService = TemplatesService;
exports.TemplatesService = TemplatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TemplatesService);
//# sourceMappingURL=templates.service.js.map