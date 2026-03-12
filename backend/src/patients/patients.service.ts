import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreatePatientQuickDto } from './dto/create-patient-quick.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePatientAdminDto } from './dto/update-patient-admin.dto';
import { UpdatePatientHistoryDto } from './dto/update-patient-history.dto';
import { validateRut } from '../common/utils/helpers';
import { Prisma } from '@prisma/client';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(createPatientDto: CreatePatientDto, userId: string) {
    // Validate RUT if provided
    let formattedRut: string | undefined = undefined;
    
    if (createPatientDto.rut && !createPatientDto.rutExempt) {
      const rutValidation = validateRut(createPatientDto.rut);
      if (!rutValidation.valid) {
        throw new BadRequestException('El RUT ingresado no es válido');
      }

      // Check for duplicate RUT
      const existingPatient = await this.prisma.patient.findUnique({
        where: { rut: rutValidation.formatted ?? undefined },
      });
      if (existingPatient) {
        throw new ConflictException('Ya existe un paciente con este RUT');
      }

      formattedRut = rutValidation.formatted ?? undefined;
    }

    // If exempt, require reason
    if (createPatientDto.rutExempt && !createPatientDto.rutExemptReason) {
      throw new BadRequestException('Debe indicar el motivo de exención de RUT');
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
          create: {}, // Create empty history record
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

  async createQuick(createPatientDto: CreatePatientQuickDto, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    // Validate RUT if provided
    let formattedRut: string | undefined = undefined;

    if (createPatientDto.rut && !createPatientDto.rutExempt) {
      const rutValidation = validateRut(createPatientDto.rut);
      if (!rutValidation.valid) {
        throw new BadRequestException('El RUT ingresado no es valido');
      }

      const existingPatient = await this.prisma.patient.findUnique({
        where: { rut: rutValidation.formatted ?? undefined },
      });
      if (existingPatient) {
        throw new ConflictException('Ya existe un paciente con este RUT');
      }

      formattedRut = rutValidation.formatted ?? undefined;
    }

    if (createPatientDto.rutExempt && !createPatientDto.rutExemptReason) {
      throw new BadRequestException('Debe indicar el motivo de exencion de RUT');
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


  async findAll(
    user: RequestUser,
    search?: string,
    page = 1,
    limit = 20,
    filters?: {
      sexo?: string;
      prevision?: string;
      edadMin?: number;
      edadMax?: number;
      sortBy?: 'nombre' | 'edad' | 'createdAt' | 'updatedAt';
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const skip = (page - 1) * limit;

    const where: any = {
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

    if (filters?.sexo) where.sexo = filters.sexo;
    if (filters?.prevision) where.prevision = filters.prevision;
    if (filters?.edadMin !== undefined || filters?.edadMax !== undefined) {
      where.edad = {};
      if (filters.edadMin !== undefined) where.edad.gte = filters.edadMin;
      if (filters.edadMax !== undefined) where.edad.lte = filters.edadMax;
    }

    const orderBy = filters?.sortBy
      ? { [filters.sortBy]: filters.sortOrder || 'asc' }
      : { createdAt: 'desc' as const };

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

  async findById(user: RequestUser, id: string) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
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
      throw new NotFoundException('Paciente no encontrado');
    }

    if (patient.medicoId !== effectiveMedicoId) {
      throw new NotFoundException('Paciente no encontrado');
    }

    return patient;
  }

  async update(id: string, updatePatientDto: UpdatePatientDto, userId: string) {
    const existingPatient = await this.prisma.patient.findUnique({ where: { id } });

    if (!existingPatient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (existingPatient.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para editar este paciente');
    }

    // Prepare update data
    const updateData: Prisma.PatientUpdateInput = { ...updatePatientDto };

    // Normalize optional strings
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

    // Handle RUT exemption rules consistently
    const dtoRutExempt = updatePatientDto.rutExempt;
    const dtoRutExemptReason = updatePatientDto.rutExemptReason;
    const nextRutExempt = dtoRutExempt !== undefined ? dtoRutExempt : existingPatient.rutExempt;

    if (nextRutExempt) {
      const reason = (dtoRutExemptReason ?? existingPatient.rutExemptReason ?? '').trim();
      if (!reason) {
        throw new BadRequestException('Debe indicar el motivo de exención de RUT');
      }

      const dtoRut = updatePatientDto.rut;
      if (dtoRut && dtoRut.trim().length > 0) {
        throw new BadRequestException('No puede indicar RUT si el paciente está marcado como sin RUT');
      }

      updateData.rut = null;
      updateData.rutExempt = true;
      updateData.rutExemptReason = reason;
    } else {
      // If explicitly un-exempting, clear reason
      if (dtoRutExempt === false) {
        updateData.rutExemptReason = null;
      }
    }

    // Validate new RUT if changing (only when not exempt)
    const dtoRut = updatePatientDto.rut;
    if (!nextRutExempt && dtoRut && dtoRut !== existingPatient.rut) {
      const rutValidation = validateRut(dtoRut);
      if (!rutValidation.valid) {
        throw new BadRequestException('El RUT ingresado no es válido');
      }

      const duplicateRut = await this.prisma.patient.findFirst({
        where: {
          rut: rutValidation.formatted ?? undefined,
          id: { not: id },
        },
      });

      if (duplicateRut) {
        throw new ConflictException('Ya existe un paciente con este RUT');
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

  async updateAdminFields(user: RequestUser, patientId: string, dto: UpdatePatientAdminDto) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const existingPatient = await this.prisma.patient.findUnique({ where: { id: patientId } });

    if (!existingPatient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (existingPatient.medicoId !== effectiveMedicoId) {
      throw new NotFoundException('Paciente no encontrado');
    }

    const updateData: Prisma.PatientUpdateInput = {};
    if (dto.edad !== undefined) updateData.edad = dto.edad;
    if (dto.sexo !== undefined) updateData.sexo = dto.sexo;
    if (dto.prevision !== undefined) updateData.prevision = dto.prevision;
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

  async updateHistory(user: RequestUser, patientId: string, dto: UpdatePatientHistoryDto) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: { history: true },
    });

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (patient.medicoId !== effectiveMedicoId) {
      throw new NotFoundException('Paciente no encontrado');
    }

    const previousHistory = patient.history;

    // Serialize objects to JSON strings for SQLite
    // Use !== undefined to allow empty strings/objects/null to clear fields
    const historyData: Record<string, string | null> = {};
    if (dto.antecedentesMedicos !== undefined) historyData.antecedentesMedicos = dto.antecedentesMedicos ? JSON.stringify(dto.antecedentesMedicos) : null;
    if (dto.antecedentesQuirurgicos !== undefined) historyData.antecedentesQuirurgicos = dto.antecedentesQuirurgicos ? JSON.stringify(dto.antecedentesQuirurgicos) : null;
    if (dto.antecedentesGinecoobstetricos !== undefined) historyData.antecedentesGinecoobstetricos = dto.antecedentesGinecoobstetricos ? JSON.stringify(dto.antecedentesGinecoobstetricos) : null;
    if (dto.antecedentesFamiliares !== undefined) historyData.antecedentesFamiliares = dto.antecedentesFamiliares ? JSON.stringify(dto.antecedentesFamiliares) : null;
    if (dto.habitos !== undefined) historyData.habitos = dto.habitos ? JSON.stringify(dto.habitos) : null;
    if (dto.medicamentos !== undefined) historyData.medicamentos = dto.medicamentos ? JSON.stringify(dto.medicamentos) : null;
    if (dto.alergias !== undefined) historyData.alergias = dto.alergias ? JSON.stringify(dto.alergias) : null;
    if (dto.inmunizaciones !== undefined) historyData.inmunizaciones = dto.inmunizaciones ? JSON.stringify(dto.inmunizaciones) : null;
    if (dto.antecedentesSociales !== undefined) historyData.antecedentesSociales = dto.antecedentesSociales ? JSON.stringify(dto.antecedentesSociales) : null;
    if (dto.antecedentesPersonales !== undefined) historyData.antecedentesPersonales = dto.antecedentesPersonales ? JSON.stringify(dto.antecedentesPersonales) : null;

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

  async remove(id: string, userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (patient.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para eliminar este paciente');
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
}
