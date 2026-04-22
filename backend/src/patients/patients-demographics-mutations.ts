import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Patient, Prisma } from '@prisma/client';
import { validateRut } from '../common/utils/helpers';
import { isPatientOwnedByMedico } from '../common/utils/patient-access';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/utils/medico-id';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePatientAdminDto } from './dto/update-patient-admin.dto';
import { normalizeNullableEmail, normalizeNullableString, resolvePatientVerificationState } from './patients-format';
import { applySharedDemographicFields, findDuplicateRut } from './patients-demographics-mutations.helpers';

type ExistingPatient = Patient & {
  createdBy?: {
    medicoId: string | null;
  } | null;
  history?: unknown;
};

interface UpdatePatientDemographicsMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  id: string;
  updatePatientDto: UpdatePatientDto;
  user: RequestUser;
  effectiveMedicoId: string;
}

interface UpdatePatientAdminDemographicsMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  patientId: string;
  dto: UpdatePatientAdminDto;
  user: RequestUser;
  assertPatientAccess: (user: RequestUser, patientId: string) => Promise<ExistingPatient>;
}


export async function updatePatientDemographicsMutation(params: UpdatePatientDemographicsMutationParams) {
  const {
    prisma,
    auditService,
    id,
    updatePatientDto,
    user,
    effectiveMedicoId,
  } = params;

  const existingPatient = await prisma.patient.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { medicoId: true },
      },
    },
  });

  if (!existingPatient) {
    throw new NotFoundException('Paciente no encontrado');
  }

  if (existingPatient.archivedAt) {
    throw new BadRequestException('No se puede editar un paciente archivado');
  }

  if (!user.isAdmin && !isPatientOwnedByMedico(existingPatient, effectiveMedicoId)) {
    throw new ForbiddenException('No tiene permisos para editar este paciente');
  }

  const updateData: Prisma.PatientUpdateInput = {};

  if (updatePatientDto.nombre !== undefined) {
    updateData.nombre = updatePatientDto.nombre.trim();
  }

  applySharedDemographicFields(updateData, {
    fechaNacimiento: updatePatientDto.fechaNacimiento,
    edad: updatePatientDto.edad,
    edadMeses: updatePatientDto.edadMeses,
    sexo: updatePatientDto.sexo,
    prevision: updatePatientDto.prevision,
    trabajo: updatePatientDto.trabajo,
    domicilio: updatePatientDto.domicilio,
    telefono: updatePatientDto.telefono,
    email: updatePatientDto.email,
    contactoEmergenciaNombre: updatePatientDto.contactoEmergenciaNombre,
    contactoEmergenciaTelefono: updatePatientDto.contactoEmergenciaTelefono,
    centroMedico: updatePatientDto.centroMedico,
  });

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
  } else if (dtoRutExempt === false) {
    updateData.rutExemptReason = null;
  }

  const dtoRut = updatePatientDto.rut;
  if (!nextRutExempt && dtoRut !== undefined) {
    const trimmedRut = dtoRut?.trim() || '';

    if (!trimmedRut) {
      updateData.rut = null;
    } else if (trimmedRut !== existingPatient.rut) {
      const rutValidation = validateRut(trimmedRut);
      if (!rutValidation.valid) {
        throw new BadRequestException('El RUT ingresado no es válido');
      }

      const validatedRut = rutValidation.formatted as string;

      const duplicateRut = await findDuplicateRut(prisma, {
        rut: validatedRut,
        excludePatientId: id,
      });

      if (duplicateRut) {
        throw new ConflictException('Ya existe un paciente con este RUT');
      }

      updateData.rut = validatedRut;
    }
  }

  const nextPatient = {
    ...existingPatient,
    ...updateData,
  };

  Object.assign(
    updateData,
    resolvePatientVerificationState({
      currentPatient: existingPatient,
      nextPatient,
      actorId: user.id,
      actorRole: user.role,
      mode: 'UPDATE_FULL',
    }),
  );

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.update({
      where: { id },
      data: updateData,
      include: { history: true },
    });

    await auditService.log(
      {
        entityType: 'Patient',
        entityId: patient.id,
        userId: user.id,
        action: 'UPDATE',
        diff: {
          before: existingPatient,
          after: patient,
        },
      },
      tx,
    );

    return patient;
  });
}

export async function updatePatientAdminDemographicsMutation(params: UpdatePatientAdminDemographicsMutationParams) {
  const {
    prisma,
    auditService,
    patientId,
    dto,
    user,
    assertPatientAccess,
  } = params;

  const existingPatient = await assertPatientAccess(user, patientId);
  const updateData: Prisma.PatientUpdateInput = {};

  applySharedDemographicFields(updateData, {
    fechaNacimiento: dto.fechaNacimiento,
    edad: dto.edad,
    edadMeses: dto.edadMeses,
    sexo: dto.sexo,
    prevision: dto.prevision,
    trabajo: dto.trabajo,
    domicilio: dto.domicilio,
    telefono: dto.telefono,
    email: dto.email,
    contactoEmergenciaNombre: dto.contactoEmergenciaNombre,
    contactoEmergenciaTelefono: dto.contactoEmergenciaTelefono,
    centroMedico: dto.centroMedico,
  });

  const nextPatient = {
    ...existingPatient,
    ...updateData,
  };

  Object.assign(
    updateData,
    resolvePatientVerificationState({
      currentPatient: existingPatient,
      nextPatient,
      actorId: user.id,
      actorRole: user.role,
      mode: 'UPDATE_ADMIN',
    }),
  );

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.update({
      where: { id: patientId },
      data: updateData,
      include: { history: true },
    });

    await auditService.log(
      {
        entityType: 'Patient',
        entityId: patient.id,
        userId: user.id,
        action: 'UPDATE',
        diff: {
          before: existingPatient,
          after: patient,
          scope: 'ADMIN_FIELDS',
        },
      },
      tx,
    );

    return patient;
  });
}
