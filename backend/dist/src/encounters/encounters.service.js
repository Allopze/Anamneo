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
exports.EncountersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const medico_id_1 = require("../common/utils/medico-id");
const SECTION_ORDER = [
    'IDENTIFICACION',
    'MOTIVO_CONSULTA',
    'ANAMNESIS_PROXIMA',
    'ANAMNESIS_REMOTA',
    'REVISION_SISTEMAS',
    'EXAMEN_FISICO',
    'SOSPECHA_DIAGNOSTICA',
    'TRATAMIENTO',
    'RESPUESTA_TRATAMIENTO',
    'OBSERVACIONES',
];
const SECTION_LABELS = {
    IDENTIFICACION: 'Identificación del paciente',
    MOTIVO_CONSULTA: 'Motivo de consulta',
    ANAMNESIS_PROXIMA: 'Anamnesis próxima',
    ANAMNESIS_REMOTA: 'Anamnesis remota',
    REVISION_SISTEMAS: 'Revisión por sistemas',
    EXAMEN_FISICO: 'Examen físico',
    SOSPECHA_DIAGNOSTICA: 'Sospecha diagnóstica',
    TRATAMIENTO: 'Tratamiento',
    RESPUESTA_TRATAMIENTO: 'Respuesta al tratamiento',
    OBSERVACIONES: 'Observaciones',
};
let EncountersService = class EncountersService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(patientId, createDto, user) {
        let result;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                result = await this.prisma.$transaction(async (tx) => {
                    const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
                    const patient = await tx.patient.findUnique({
                        where: { id: patientId },
                        include: { history: true },
                    });
                    if (!patient) {
                        throw new common_1.NotFoundException('Paciente no encontrado');
                    }
                    if (patient.medicoId !== effectiveMedicoId) {
                        throw new common_1.ForbiddenException('No tiene permisos para crear una atención para este paciente');
                    }
                    const inProgress = await tx.encounter.findMany({
                        where: {
                            patientId,
                            status: 'EN_PROGRESO',
                        },
                        orderBy: { createdAt: 'desc' },
                        include: {
                            sections: { select: { completed: true } },
                            patient: true,
                            createdBy: { select: { id: true, nombre: true, email: true } },
                        },
                    });
                    if (inProgress.length === 1) {
                        return {
                            ...this.formatEncounter(inProgress[0]),
                            reused: true,
                        };
                    }
                    if (inProgress.length > 1) {
                        throw new common_1.ConflictException({
                            message: 'Hay múltiples atenciones en progreso para este paciente. Selecciona cuál abrir.',
                            inProgressEncounters: inProgress.map((enc) => ({
                                id: enc.id,
                                status: enc.status,
                                createdAt: enc.createdAt,
                                updatedAt: enc.updatedAt,
                                createdBy: enc.createdBy,
                                progress: {
                                    completed: enc.sections.filter((s) => s.completed).length,
                                    total: enc.sections.length,
                                },
                            })),
                        });
                    }
                    const encounter = await tx.encounter.create({
                        data: {
                            patientId,
                            createdById: user.id,
                            status: 'EN_PROGRESO',
                            sections: {
                                create: SECTION_ORDER.map((key) => {
                                    const sectionData = key === 'IDENTIFICACION'
                                        ? {
                                            nombre: patient.nombre,
                                            edad: patient.edad,
                                            sexo: patient.sexo,
                                            trabajo: patient.trabajo || '',
                                            prevision: patient.prevision,
                                            domicilio: patient.domicilio || '',
                                            rut: patient.rut || '',
                                            rutExempt: patient.rutExempt,
                                            rutExemptReason: patient.rutExemptReason || '',
                                        }
                                        : key === 'ANAMNESIS_REMOTA' && patient.history
                                            ? { ...patient.history, readonly: true }
                                            : {};
                                    return {
                                        sectionKey: key,
                                        data: JSON.stringify(sectionData),
                                        completed: false,
                                    };
                                }),
                            },
                        },
                        include: {
                            sections: true,
                            patient: true,
                            createdBy: {
                                select: { id: true, nombre: true, email: true },
                            },
                        },
                    });
                    return {
                        ...this.formatEncounter(encounter),
                        reused: false,
                    };
                }, {
                    isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
                });
                break;
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 3) {
                    continue;
                }
                throw error;
            }
        }
        if (!result) {
            throw new common_1.ConflictException('No se pudo crear la atención. Intente nuevamente.');
        }
        if (!result.reused) {
            await this.auditService.log({
                entityType: 'Encounter',
                entityId: result.id,
                userId: user.id,
                action: 'CREATE',
                diff: { patientId, status: 'EN_PROGRESO' },
            });
        }
        return result;
    }
    async findAll(user, status, search, page = 1, limit = 15) {
        const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        const skip = (page - 1) * limit;
        const where = {
            patient: { medicoId: effectiveMedicoId },
        };
        if (status && ['EN_PROGRESO', 'COMPLETADO', 'CANCELADO'].includes(status)) {
            where.status = status;
        }
        const trimmedSearch = search?.trim();
        if (trimmedSearch) {
            where.OR = [
                { patient: { nombre: { contains: trimmedSearch, mode: 'insensitive' } } },
                { patient: { rut: { contains: trimmedSearch, mode: 'insensitive' } } },
            ];
        }
        const [encounters, total] = await Promise.all([
            this.prisma.encounter.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    patient: true,
                    createdBy: {
                        select: { id: true, nombre: true },
                    },
                    sections: {
                        select: { completed: true },
                    },
                },
            }),
            this.prisma.encounter.count({ where }),
        ]);
        return {
            data: encounters.map((enc) => ({
                ...enc,
                progress: {
                    completed: enc.sections.filter((s) => s.completed).length,
                    total: enc.sections.length,
                },
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async findById(id, user) {
        const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        const encounter = await this.prisma.encounter.findFirst({
            where: {
                id,
                patient: { medicoId: effectiveMedicoId },
            },
            include: {
                sections: {
                    orderBy: { sectionKey: 'asc' },
                },
                patient: {
                    include: { history: true },
                },
                createdBy: {
                    select: { id: true, nombre: true, email: true },
                },
                suggestions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                attachments: true,
            },
        });
        if (!encounter) {
            throw new common_1.NotFoundException('Atención no encontrada');
        }
        return this.formatEncounter(encounter);
    }
    async findByPatient(patientId, user) {
        const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        const encounters = await this.prisma.encounter.findMany({
            where: {
                patientId,
                patient: { medicoId: effectiveMedicoId },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                createdBy: {
                    select: { id: true, nombre: true },
                },
                sections: {
                    select: { sectionKey: true, completed: true },
                },
            },
        });
        return encounters.map((enc) => ({
            ...enc,
            progress: {
                completed: enc.sections.filter((s) => s.completed).length,
                total: enc.sections.length,
            },
        }));
    }
    async updateSection(encounterId, sectionKey, dto, user) {
        const encounter = await this.prisma.encounter.findUnique({
            where: { id: encounterId },
            include: { sections: true, patient: true },
        });
        if (!encounter) {
            throw new common_1.NotFoundException('Atención no encontrada');
        }
        const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        if (encounter.patient.medicoId !== effectiveMedicoId) {
            throw new common_1.ForbiddenException('No tiene permisos para editar esta atención');
        }
        if (encounter.status === 'COMPLETADO') {
            throw new common_1.BadRequestException('No se puede editar una atención completada');
        }
        if (encounter.createdById !== user.id && user.role !== 'MEDICO') {
            throw new common_1.ForbiddenException('No tiene permisos para editar esta atención');
        }
        const section = encounter.sections.find((s) => s.sectionKey === sectionKey);
        if (!section) {
            throw new common_1.NotFoundException('Sección no encontrada');
        }
        const updatedSection = await this.prisma.encounterSection.update({
            where: { id: section.id },
            data: {
                data: JSON.stringify(dto.data),
                completed: dto.completed ?? section.completed,
            },
        });
        await this.auditService.log({
            entityType: 'EncounterSection',
            entityId: section.id,
            userId: user.id,
            action: 'UPDATE',
            diff: {
                sectionKey,
                data: JSON.stringify(dto.data),
                completed: dto.completed,
            },
        });
        return updatedSection;
    }
    async complete(id, userId) {
        const encounter = await this.prisma.encounter.findUnique({
            where: { id },
            include: { sections: true, patient: true },
        });
        if (!encounter) {
            throw new common_1.NotFoundException('Atención no encontrada');
        }
        if (encounter.patient.medicoId !== userId) {
            throw new common_1.ForbiddenException('No tiene permisos para completar esta atención');
        }
        const incompleteSections = encounter.sections.filter((s) => !s.completed && ['IDENTIFICACION', 'MOTIVO_CONSULTA'].includes(s.sectionKey));
        if (incompleteSections.length > 0) {
            throw new common_1.BadRequestException(`Las siguientes secciones obligatorias no están completas: ${incompleteSections
                .map((s) => SECTION_LABELS[s.sectionKey])
                .join(', ')}`);
        }
        const updated = await this.prisma.encounter.update({
            where: { id },
            data: {
                status: 'COMPLETADO',
                completedAt: new Date(),
                completedById: userId,
            },
            include: {
                sections: true,
                patient: true,
                createdBy: { select: { id: true, nombre: true } },
            },
        });
        await this.auditService.log({
            entityType: 'Encounter',
            entityId: id,
            userId,
            action: 'UPDATE',
            diff: { status: 'COMPLETADO' },
        });
        return this.formatEncounter(updated);
    }
    async reopen(id, userId) {
        const encounter = await this.prisma.encounter.findUnique({
            where: { id },
        });
        if (!encounter) {
            throw new common_1.NotFoundException('Atención no encontrada');
        }
        if (encounter.status !== 'COMPLETADO') {
            throw new common_1.BadRequestException('Solo se pueden reabrir atenciones completadas');
        }
        const updated = await this.prisma.encounter.update({
            where: { id },
            data: {
                status: 'EN_PROGRESO',
                completedAt: null,
                completedById: null,
            },
            include: {
                sections: true,
                patient: true,
                createdBy: { select: { id: true, nombre: true } },
            },
        });
        await this.auditService.log({
            entityType: 'Encounter',
            entityId: id,
            userId,
            action: 'UPDATE',
            diff: { status: 'EN_PROGRESO', reopenedBy: userId },
        });
        return this.formatEncounter(updated);
    }
    async cancel(id, userId) {
        const encounter = await this.prisma.encounter.findUnique({
            where: { id },
            include: { patient: true },
        });
        if (!encounter) {
            throw new common_1.NotFoundException('Atención no encontrada');
        }
        if (encounter.patient.medicoId !== userId) {
            throw new common_1.ForbiddenException('No tiene permisos para cancelar esta atención');
        }
        const updated = await this.prisma.encounter.update({
            where: { id },
            data: { status: 'CANCELADO' },
        });
        await this.auditService.log({
            entityType: 'Encounter',
            entityId: id,
            userId,
            action: 'UPDATE',
            diff: { status: 'CANCELADO' },
        });
        return updated;
    }
    async getDashboard(user) {
        const medicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        const where = medicoId ? { patient: { medicoId } } : {};
        const [enProgreso, completado, cancelado, recent] = await Promise.all([
            this.prisma.encounter.count({ where: { ...where, status: 'EN_PROGRESO' } }),
            this.prisma.encounter.count({ where: { ...where, status: 'COMPLETADO' } }),
            this.prisma.encounter.count({ where: { ...where, status: 'CANCELADO' } }),
            this.prisma.encounter.findMany({
                where,
                take: 5,
                orderBy: { updatedAt: 'desc' },
                include: {
                    patient: { select: { id: true, nombre: true, rut: true } },
                    createdBy: { select: { id: true, nombre: true } },
                    sections: { select: { sectionKey: true, completed: true } },
                },
            }),
        ]);
        return {
            counts: { enProgreso, completado, cancelado, total: enProgreso + completado + cancelado },
            recent: recent.map((enc) => ({
                id: enc.id,
                patientId: enc.patientId,
                patientName: enc.patient.nombre,
                patientRut: enc.patient.rut,
                createdByName: enc.createdBy.nombre,
                status: enc.status,
                createdAt: enc.createdAt,
                updatedAt: enc.updatedAt,
                progress: {
                    completed: enc.sections.filter((s) => s.completed).length,
                    total: enc.sections.length,
                },
            })),
        };
    }
    formatEncounter(encounter) {
        const sortedSections = [...(encounter.sections || [])].sort((a, b) => {
            return SECTION_ORDER.indexOf(a.sectionKey) - SECTION_ORDER.indexOf(b.sectionKey);
        });
        return {
            ...encounter,
            sections: sortedSections.map((section) => ({
                ...section,
                label: SECTION_LABELS[section.sectionKey],
                order: SECTION_ORDER.indexOf(section.sectionKey),
            })),
        };
    }
};
exports.EncountersService = EncountersService;
exports.EncountersService = EncountersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], EncountersService);
//# sourceMappingURL=encounters.service.js.map