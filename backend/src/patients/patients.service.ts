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
import { parseEncounterSections } from '../common/utils/encounter-sections';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private formatTask(task: any) {
    return {
      ...task,
      createdBy: task.createdBy ? { id: task.createdBy.id, nombre: task.createdBy.nombre } : undefined,
    };
  }

  private formatProblem(problem: any) {
    return {
      ...problem,
      encounter: problem.encounter
        ? {
            id: problem.encounter.id,
            createdAt: problem.encounter.createdAt,
            status: problem.encounter.status,
          }
        : null,
    };
  }

  private async assertPatientAccess(user: RequestUser, patientId: string) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: { history: true },
    });

    if (!patient || patient.medicoId !== effectiveMedicoId || patient.archivedAt) {
      throw new NotFoundException('Paciente no encontrado');
    }

    return patient;
  }

  async create(createPatientDto: CreatePatientDto, userId: string) {
    // Validate RUT if provided
    let formattedRut: string | undefined = undefined;
    const trimmedRutExemptReason = createPatientDto.rutExemptReason?.trim();
    
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
    if (createPatientDto.rutExempt && !trimmedRutExemptReason) {
      throw new BadRequestException('Debe indicar el motivo de exención de RUT');
    }

    const patient = await this.prisma.patient.create({
      data: {
        medicoId: userId,
        rut: createPatientDto.rutExempt ? null : (formattedRut || createPatientDto.rut || null),
        rutExempt: createPatientDto.rutExempt || false,
        rutExemptReason: trimmedRutExemptReason || null,
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
    const trimmedRutExemptReason = createPatientDto.rutExemptReason?.trim();

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

    if (createPatientDto.rutExempt && !trimmedRutExemptReason) {
      throw new BadRequestException('Debe indicar el motivo de exencion de RUT');
    }

    const patient = await this.prisma.patient.create({
      data: {
        medicoId: effectiveMedicoId,
        rut: createPatientDto.rutExempt ? null : (formattedRut || createPatientDto.rut || null),
        rutExempt: createPatientDto.rutExempt || false,
        rutExemptReason: trimmedRutExemptReason || null,
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
      archivedAt: null,
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
      where: { archivedAt: null },
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
        problems: {
          orderBy: [
            { status: 'asc' },
            { updatedAt: 'desc' },
          ],
          include: {
            encounter: {
              select: { id: true, createdAt: true, status: true },
            },
          },
        },
        tasks: {
          orderBy: [
            { status: 'asc' },
            { dueDate: 'asc' },
            { createdAt: 'desc' },
          ],
          include: {
            createdBy: {
              select: { id: true, nombre: true },
            },
          },
        },
        encounters: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: {
              select: { id: true, nombre: true },
            },
            reviewedBy: {
              select: { id: true, nombre: true },
            },
            sections: true,
          },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (patient.medicoId !== effectiveMedicoId || patient.archivedAt) {
      throw new NotFoundException('Paciente no encontrado');
    }

    return {
      ...patient,
      problems: patient.problems.map((problem) => this.formatProblem(problem)),
      tasks: patient.tasks.map((task) => this.formatTask(task)),
      encounters: patient.encounters.map((encounter) => parseEncounterSections(encounter)),
    };
  }

  async findTasks(
    user: RequestUser,
    filters?: {
      search?: string;
      status?: string;
      type?: string;
      page?: number;
      limit?: number;
      overdueOnly?: boolean;
    },
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.EncounterTaskWhereInput = {
      patient: {
        medicoId: effectiveMedicoId,
        archivedAt: null,
      },
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.search?.trim()) {
      where.OR = [
        { title: { contains: filters.search.trim() } },
        { details: { contains: filters.search.trim() } },
        { patient: { nombre: { contains: filters.search.trim() } } },
      ];
    }

    if (filters?.overdueOnly) {
      where.dueDate = { lt: new Date() };
      where.status = { in: ['PENDIENTE', 'EN_PROCESO'] } as any;
    }

    const [tasks, total] = await Promise.all([
      this.prisma.encounterTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          patient: {
            select: { id: true, nombre: true, rut: true },
          },
          createdBy: {
            select: { id: true, nombre: true },
          },
        },
      }),
      this.prisma.encounterTask.count({ where }),
    ]);

    const now = new Date();

    return {
      data: tasks.map((task) => ({
        ...this.formatTask(task),
        isOverdue: Boolean(
          task.dueDate
          && task.dueDate < now
          && ['PENDIENTE', 'EN_PROCESO'].includes(task.status),
        ),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, updatePatientDto: UpdatePatientDto, userId: string) {
    const existingPatient = await this.prisma.patient.findUnique({ where: { id } });

    if (!existingPatient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (existingPatient.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para editar este paciente');
    }

    if (existingPatient.archivedAt) {
      throw new BadRequestException('No se puede editar un paciente archivado');
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

    if (existingPatient.archivedAt) {
      throw new BadRequestException('No se puede editar un paciente archivado');
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

    if (patient.archivedAt) {
      throw new BadRequestException('No se puede editar el historial de un paciente archivado');
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

    if (patient.archivedAt) {
      return { message: 'El paciente ya se encuentra archivado' };
    }

    const archivedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.encounter.updateMany({
        where: {
          patientId: id,
          status: 'EN_PROGRESO',
        },
        data: {
          status: 'CANCELADO',
        },
      }),
      this.prisma.patient.update({
        where: { id },
        data: {
          archivedAt,
          archivedById: userId,
        },
      }),
    ]);

    await this.auditService.log({
      entityType: 'Patient',
      entityId: id,
      userId,
      action: 'UPDATE',
      diff: {
        archivedAt: archivedAt.toISOString(),
        archivedById: userId,
        previousStatus: patient,
      },
    });

    return { message: 'Paciente archivado correctamente' };
  }

  async restore(id: string, userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (patient.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para restaurar este paciente');
    }

    if (!patient.archivedAt) {
      return { message: 'El paciente ya se encuentra activo' };
    }

    await this.prisma.patient.update({
      where: { id },
      data: {
        archivedAt: null,
        archivedById: null,
      },
    });

    await this.auditService.log({
      entityType: 'Patient',
      entityId: id,
      userId,
      action: 'UPDATE',
      diff: {
        restoredAt: new Date().toISOString(),
        previousArchivedAt: patient.archivedAt.toISOString(),
        previousArchivedById: patient.archivedById,
      },
    });

    return { message: 'Paciente restaurado correctamente' };
  }

  async createProblem(
    user: RequestUser,
    patientId: string,
    dto: {
      label: string;
      status?: string;
      notes?: string;
      severity?: string;
      onsetDate?: string;
      encounterId?: string;
    },
  ) {
    await this.assertPatientAccess(user, patientId);

    if (dto.encounterId) {
      const encounter = await this.prisma.encounter.findFirst({
        where: {
          id: dto.encounterId,
          patientId,
        },
      });

      if (!encounter) {
        throw new BadRequestException('La atención asociada no existe para este paciente');
      }
    }

    const created = await this.prisma.patientProblem.create({
      data: {
        patientId,
        encounterId: dto.encounterId || null,
        label: dto.label.trim(),
        status: dto.status || 'ACTIVO',
        notes: dto.notes?.trim() || null,
        severity: dto.severity?.trim() || null,
        onsetDate: dto.onsetDate ? new Date(dto.onsetDate) : null,
      },
      include: {
        encounter: {
          select: { id: true, createdAt: true, status: true },
        },
      },
    });

    await this.auditService.log({
      entityType: 'PatientProblem',
      entityId: created.id,
      userId: user.id,
      action: 'CREATE',
      diff: { created },
    });

    return this.formatProblem(created);
  }

  async updateProblem(
    user: RequestUser,
    problemId: string,
    dto: {
      label?: string;
      status?: string;
      notes?: string;
      severity?: string;
      onsetDate?: string;
    },
  ) {
    const problem = await this.prisma.patientProblem.findUnique({
      where: { id: problemId },
      include: {
        patient: true,
        encounter: {
          select: { id: true, createdAt: true, status: true },
        },
      },
    });

    if (!problem || problem.patient.medicoId !== getEffectiveMedicoId(user) || problem.patient.archivedAt) {
      throw new NotFoundException('Problema clínico no encontrado');
    }

    const updated = await this.prisma.patientProblem.update({
      where: { id: problemId },
      data: {
        label: dto.label?.trim() || problem.label,
        status: dto.status || problem.status,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : problem.notes,
        severity: dto.severity !== undefined ? dto.severity.trim() || null : problem.severity,
        onsetDate: dto.onsetDate !== undefined ? (dto.onsetDate ? new Date(dto.onsetDate) : null) : problem.onsetDate,
        resolvedAt: dto.status === 'RESUELTO' ? new Date() : dto.status ? null : problem.resolvedAt,
      },
      include: {
        encounter: {
          select: { id: true, createdAt: true, status: true },
        },
      },
    });

    await this.auditService.log({
      entityType: 'PatientProblem',
      entityId: updated.id,
      userId: user.id,
      action: 'UPDATE',
      diff: { before: problem, after: updated },
    });

    return this.formatProblem(updated);
  }

  async createTask(
    user: RequestUser,
    patientId: string,
    dto: {
      title: string;
      details?: string;
      type?: string;
      priority?: string;
      status?: string;
      dueDate?: string;
      encounterId?: string;
    },
  ) {
    await this.assertPatientAccess(user, patientId);

    if (dto.encounterId) {
      const encounter = await this.prisma.encounter.findFirst({
        where: {
          id: dto.encounterId,
          patientId,
        },
      });

      if (!encounter) {
        throw new BadRequestException('La atención asociada no existe para este paciente');
      }
    }

    const created = await this.prisma.encounterTask.create({
      data: {
        patientId,
        encounterId: dto.encounterId || null,
        createdById: user.id,
        title: dto.title.trim(),
        details: dto.details?.trim() || null,
        type: dto.type || 'SEGUIMIENTO',
        priority: dto.priority || 'MEDIA',
        status: dto.status || 'PENDIENTE',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: {
        createdBy: {
          select: { id: true, nombre: true },
        },
      },
    });

    await this.auditService.log({
      entityType: 'EncounterTask',
      entityId: created.id,
      userId: user.id,
      action: 'CREATE',
      diff: { created },
    });

    return this.formatTask(created);
  }

  async updateTaskStatus(
    user: RequestUser,
    taskId: string,
    dto: {
      title?: string;
      status?: string;
      details?: string;
      type?: string;
      priority?: string;
      dueDate?: string;
    },
  ) {
    const task = await this.prisma.encounterTask.findUnique({
      where: { id: taskId },
      include: {
        patient: true,
        createdBy: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (!task || task.patient.medicoId !== getEffectiveMedicoId(user) || task.patient.archivedAt) {
      throw new NotFoundException('Seguimiento no encontrado');
    }

    const updated = await this.prisma.encounterTask.update({
      where: { id: taskId },
      data: {
        title: dto.title?.trim() || task.title,
        status: dto.status || task.status,
        details: dto.details !== undefined ? dto.details.trim() || null : task.details,
        type: dto.type || task.type,
        priority: dto.priority || task.priority,
        dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : task.dueDate,
        completedAt: dto.status === 'COMPLETADA' ? new Date() : dto.status && dto.status !== 'COMPLETADA' ? null : task.completedAt,
      },
      include: {
        createdBy: {
          select: { id: true, nombre: true },
        },
      },
    });

    await this.auditService.log({
      entityType: 'EncounterTask',
      entityId: updated.id,
      userId: user.id,
      action: 'UPDATE',
      diff: { before: task, after: updated },
    });

    return this.formatTask(updated);
  }
}
