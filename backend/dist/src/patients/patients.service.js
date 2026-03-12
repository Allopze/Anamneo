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
exports.PatientsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const helpers_1 = require("../common/utils/helpers");
const medico_id_1 = require("../common/utils/medico-id");
let PatientsService = class PatientsService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(createPatientDto, userId) {
        let formattedRut = undefined;
        if (createPatientDto.rut && !createPatientDto.rutExempt) {
            const rutValidation = (0, helpers_1.validateRut)(createPatientDto.rut);
            if (!rutValidation.valid) {
                throw new common_1.BadRequestException('El RUT ingresado no es válido');
            }
            const existingPatient = await this.prisma.patient.findUnique({
                where: { rut: rutValidation.formatted ?? undefined },
            });
            if (existingPatient) {
                throw new common_1.ConflictException('Ya existe un paciente con este RUT');
            }
            formattedRut = rutValidation.formatted ?? undefined;
        }
        if (createPatientDto.rutExempt && !createPatientDto.rutExemptReason) {
            throw new common_1.BadRequestException('Debe indicar el motivo de exención de RUT');
        }
        const patient = await this.prisma.patient.create({
            data: {
                medicoId: userId,
                rut: createPatientDto.rutExempt ? null : (formattedRut || createPatientDto.rut || null),
                rutExempt: createPatientDto.rutExempt || false,
                rutExemptReason: createPatientDto.rutExemptReason,
                nombre: createPatientDto.nombre,
                edad: createPatientDto.edad,
                sexo: createPatientDto.sexo,
                trabajo: createPatientDto.trabajo,
                prevision: createPatientDto.prevision,
                domicilio: createPatientDto.domicilio,
                history: {
                    create: {},
                },
            },
            include: {
                history: true,
            },
        });
        await this.auditService.log({
            entityType: 'Patient',
            entityId: patient.id,
            userId,
            action: 'CREATE',
            diff: { created: patient },
        });
        return patient;
    }
    async createQuick(createPatientDto, user) {
        const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        let formattedRut = undefined;
        if (createPatientDto.rut && !createPatientDto.rutExempt) {
            const rutValidation = (0, helpers_1.validateRut)(createPatientDto.rut);
            if (!rutValidation.valid) {
                throw new common_1.BadRequestException('El RUT ingresado no es valido');
            }
            const existingPatient = await this.prisma.patient.findUnique({
                where: { rut: rutValidation.formatted ?? undefined },
            });
            if (existingPatient) {
                throw new common_1.ConflictException('Ya existe un paciente con este RUT');
            }
            formattedRut = rutValidation.formatted ?? undefined;
        }
        if (createPatientDto.rutExempt && !createPatientDto.rutExemptReason) {
            throw new common_1.BadRequestException('Debe indicar el motivo de exencion de RUT');
        }
        const patient = await this.prisma.patient.create({
            data: {
                medicoId: effectiveMedicoId,
                rut: createPatientDto.rutExempt ? null : (formattedRut || createPatientDto.rut || null),
                rutExempt: createPatientDto.rutExempt || false,
                rutExemptReason: createPatientDto.rutExemptReason,
                nombre: createPatientDto.nombre,
                edad: 0,
                sexo: 'PREFIERE_NO_DECIR',
                prevision: 'DESCONOCIDA',
                trabajo: null,
                domicilio: null,
                history: {
                    create: {},
                },
            },
            include: { history: true },
        });
        await this.auditService.log({
            entityType: 'Patient',
            entityId: patient.id,
            userId: user.id,
            action: 'CREATE',
            diff: { created: patient, quick: true },
        });
        return patient;
    }
    async findAll(user, search, page = 1, limit = 20, filters) {
        const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        const skip = (page - 1) * limit;
        const where = {
            medicoId: effectiveMedicoId,
            ...(search
                ? {
                    OR: [
                        { nombre: { contains: search } },
                        { rut: { contains: search } },
                    ],
                }
                : {}),
        };
        if (filters?.sexo)
            where.sexo = filters.sexo;
        if (filters?.prevision)
            where.prevision = filters.prevision;
        if (filters?.edadMin !== undefined || filters?.edadMax !== undefined) {
            where.edad = {};
            if (filters.edadMin !== undefined)
                where.edad.gte = filters.edadMin;
            if (filters.edadMax !== undefined)
                where.edad.lte = filters.edadMax;
        }
        const orderBy = filters?.sortBy
            ? { [filters.sortBy]: filters.sortOrder || 'asc' }
            : { createdAt: 'desc' };
        const [patients, total] = await Promise.all([
            this.prisma.patient.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    _count: {
                        select: { encounters: true },
                    },
                },
            }),
            this.prisma.patient.count({ where }),
        ]);
        return {
            data: patients,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async exportCsv() {
        const patients = await this.prisma.patient.findMany({
            orderBy: { nombre: 'asc' },
            include: { _count: { select: { encounters: true } } },
        });
        const header = 'Nombre,RUT,Edad,Sexo,Previsión,Trabajo,Domicilio,Atenciones,Creado';
        const rows = patients.map((p) => {
            const fields = [
                `"${(p.nombre || '').replace(/"/g, '""')}"`,
                p.rut || '-',
                p.edad,
                p.sexo,
                p.prevision,
                `"${(p.trabajo || '-').replace(/"/g, '""')}"`,
                `"${(p.domicilio || '-').replace(/"/g, '""')}"`,
                p._count.encounters,
                p.createdAt.toISOString().slice(0, 10),
            ];
            return fields.join(',');
        });
        return '\uFEFF' + header + '\n' + rows.join('\n');
    }
    async findById(user, id) {
        const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        const patient = await this.prisma.patient.findUnique({
            where: { id },
            include: {
                history: true,
                encounters: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        createdBy: {
                            select: { id: true, nombre: true },
                        },
                    },
                },
            },
        });
        if (!patient) {
            throw new common_1.NotFoundException('Paciente no encontrado');
        }
        if (patient.medicoId !== effectiveMedicoId) {
            throw new common_1.NotFoundException('Paciente no encontrado');
        }
        return patient;
    }
    async update(id, updatePatientDto, userId) {
        const existingPatient = await this.prisma.patient.findUnique({ where: { id } });
        if (!existingPatient) {
            throw new common_1.NotFoundException('Paciente no encontrado');
        }
        if (existingPatient.medicoId !== userId) {
            throw new common_1.ForbiddenException('No tiene permisos para editar este paciente');
        }
        const updateData = { ...updatePatientDto };
        const dtoTrabajo = updatePatientDto.trabajo;
        if (dtoTrabajo !== undefined) {
            const trimmed = dtoTrabajo.trim();
            updateData.trabajo = trimmed.length > 0 ? trimmed : null;
        }
        const dtoDomicilio = updatePatientDto.domicilio;
        if (dtoDomicilio !== undefined) {
            const trimmed = dtoDomicilio.trim();
            updateData.domicilio = trimmed.length > 0 ? trimmed : null;
        }
        const dtoRutExempt = updatePatientDto.rutExempt;
        const dtoRutExemptReason = updatePatientDto.rutExemptReason;
        const nextRutExempt = dtoRutExempt !== undefined ? dtoRutExempt : existingPatient.rutExempt;
        if (nextRutExempt) {
            const reason = (dtoRutExemptReason ?? existingPatient.rutExemptReason ?? '').trim();
            if (!reason) {
                throw new common_1.BadRequestException('Debe indicar el motivo de exención de RUT');
            }
            const dtoRut = updatePatientDto.rut;
            if (dtoRut && dtoRut.trim().length > 0) {
                throw new common_1.BadRequestException('No puede indicar RUT si el paciente está marcado como sin RUT');
            }
            updateData.rut = null;
            updateData.rutExempt = true;
            updateData.rutExemptReason = reason;
        }
        else {
            if (dtoRutExempt === false) {
                updateData.rutExemptReason = null;
            }
        }
        const dtoRut = updatePatientDto.rut;
        if (!nextRutExempt && dtoRut && dtoRut !== existingPatient.rut) {
            const rutValidation = (0, helpers_1.validateRut)(dtoRut);
            if (!rutValidation.valid) {
                throw new common_1.BadRequestException('El RUT ingresado no es válido');
            }
            const duplicateRut = await this.prisma.patient.findFirst({
                where: {
                    rut: rutValidation.formatted ?? undefined,
                    id: { not: id },
                },
            });
            if (duplicateRut) {
                throw new common_1.ConflictException('Ya existe un paciente con este RUT');
            }
            updateData.rut = rutValidation.formatted;
        }
        const patient = await this.prisma.patient.update({
            where: { id },
            data: updateData,
            include: { history: true },
        });
        await this.auditService.log({
            entityType: 'Patient',
            entityId: patient.id,
            userId,
            action: 'UPDATE',
            diff: {
                before: existingPatient,
                after: patient,
            },
        });
        return patient;
    }
    async updateAdminFields(user, patientId, dto) {
        const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        const existingPatient = await this.prisma.patient.findUnique({ where: { id: patientId } });
        if (!existingPatient) {
            throw new common_1.NotFoundException('Paciente no encontrado');
        }
        if (existingPatient.medicoId !== effectiveMedicoId) {
            throw new common_1.NotFoundException('Paciente no encontrado');
        }
        const updateData = {};
        if (dto.edad !== undefined)
            updateData.edad = dto.edad;
        if (dto.sexo !== undefined)
            updateData.sexo = dto.sexo;
        if (dto.prevision !== undefined)
            updateData.prevision = dto.prevision;
        if (dto.trabajo !== undefined) {
            const trimmed = dto.trabajo.trim();
            updateData.trabajo = trimmed.length > 0 ? trimmed : null;
        }
        if (dto.domicilio !== undefined) {
            const trimmed = dto.domicilio.trim();
            updateData.domicilio = trimmed.length > 0 ? trimmed : null;
        }
        const patient = await this.prisma.patient.update({
            where: { id: patientId },
            data: updateData,
            include: { history: true },
        });
        await this.auditService.log({
            entityType: 'Patient',
            entityId: patient.id,
            userId: user.id,
            action: 'UPDATE',
            diff: {
                before: existingPatient,
                after: patient,
                scope: 'ADMIN_FIELDS',
            },
        });
        return patient;
    }
    async updateHistory(user, patientId, dto) {
        const effectiveMedicoId = (0, medico_id_1.getEffectiveMedicoId)(user);
        const patient = await this.prisma.patient.findUnique({
            where: { id: patientId },
            include: { history: true },
        });
        if (!patient) {
            throw new common_1.NotFoundException('Paciente no encontrado');
        }
        if (patient.medicoId !== effectiveMedicoId) {
            throw new common_1.NotFoundException('Paciente no encontrado');
        }
        const previousHistory = patient.history;
        const historyData = {};
        if (dto.antecedentesMedicos !== undefined)
            historyData.antecedentesMedicos = dto.antecedentesMedicos ? JSON.stringify(dto.antecedentesMedicos) : null;
        if (dto.antecedentesQuirurgicos !== undefined)
            historyData.antecedentesQuirurgicos = dto.antecedentesQuirurgicos ? JSON.stringify(dto.antecedentesQuirurgicos) : null;
        if (dto.antecedentesGinecoobstetricos !== undefined)
            historyData.antecedentesGinecoobstetricos = dto.antecedentesGinecoobstetricos ? JSON.stringify(dto.antecedentesGinecoobstetricos) : null;
        if (dto.antecedentesFamiliares !== undefined)
            historyData.antecedentesFamiliares = dto.antecedentesFamiliares ? JSON.stringify(dto.antecedentesFamiliares) : null;
        if (dto.habitos !== undefined)
            historyData.habitos = dto.habitos ? JSON.stringify(dto.habitos) : null;
        if (dto.medicamentos !== undefined)
            historyData.medicamentos = dto.medicamentos ? JSON.stringify(dto.medicamentos) : null;
        if (dto.alergias !== undefined)
            historyData.alergias = dto.alergias ? JSON.stringify(dto.alergias) : null;
        if (dto.inmunizaciones !== undefined)
            historyData.inmunizaciones = dto.inmunizaciones ? JSON.stringify(dto.inmunizaciones) : null;
        if (dto.antecedentesSociales !== undefined)
            historyData.antecedentesSociales = dto.antecedentesSociales ? JSON.stringify(dto.antecedentesSociales) : null;
        if (dto.antecedentesPersonales !== undefined)
            historyData.antecedentesPersonales = dto.antecedentesPersonales ? JSON.stringify(dto.antecedentesPersonales) : null;
        const history = await this.prisma.patientHistory.upsert({
            where: { patientId },
            update: historyData,
            create: {
                patientId,
                ...historyData,
            },
        });
        await this.auditService.log({
            entityType: 'PatientHistory',
            entityId: history.id,
            userId: user.id,
            action: previousHistory ? 'UPDATE' : 'CREATE',
            diff: {
                before: previousHistory,
                after: history,
            },
        });
        return history;
    }
    async remove(id, userId) {
        const patient = await this.prisma.patient.findUnique({ where: { id } });
        if (!patient) {
            throw new common_1.NotFoundException('Paciente no encontrado');
        }
        if (patient.medicoId !== userId) {
            throw new common_1.ForbiddenException('No tiene permisos para eliminar este paciente');
        }
        await this.prisma.patient.delete({ where: { id } });
        await this.auditService.log({
            entityType: 'Patient',
            entityId: id,
            userId,
            action: 'DELETE',
            diff: { deleted: patient },
        });
        return { message: 'Paciente eliminado correctamente' };
    }
};
exports.PatientsService = PatientsService;
exports.PatientsService = PatientsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PatientsService);
//# sourceMappingURL=patients.service.js.map