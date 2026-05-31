import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validateRut } from '../common/utils/helpers';
import { isPatientOwnedByMedico } from '../common/utils/patient-access';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/utils/medico-id';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { normalizeNullableEmail, normalizeNullableString, resolvePatientVerificationState } from './patients-format';
import { applySharedDemographicFields, assignEncryptedIdentifierUpdates, findDuplicateRut } from './patients-demographics-mutations.helpers';
import { resolvePatientIdentifiers } from './patients-identifiers';

interface UpdatePatientDemographicsMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  id: string;
  updatePatientDto: UpdatePatientDto;
  user: RequestUser;
  effectiveMedicoId: string;
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
  const currentIdentifiers = resolvePatientIdentifiers(existingPatient);
  const identifierUpdates: Parameters<typeof assignEncryptedIdentifierUpdates>[1] = {};
  const nextPlainIdentifiers = { ...currentIdentifiers };

  if (updatePatientDto.nombre !== undefined) {
    const nombre = updatePatientDto.nombre.trim();
    identifierUpdates.nombre = nombre;
    nextPlainIdentifiers.nombre = nombre;
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

  if (updatePatientDto.domicilio !== undefined) {
    const domicilio = normalizeNullableString(updatePatientDto.domicilio) ?? null;
    identifierUpdates.domicilio = domicilio;
    nextPlainIdentifiers.domicilio = domicilio;
  }
  if (updatePatientDto.telefono !== undefined) {
    const telefono = normalizeNullableString(updatePatientDto.telefono) ?? null;
    identifierUpdates.telefono = telefono;
    nextPlainIdentifiers.telefono = telefono;
  }
  if (updatePatientDto.email !== undefined) {
    const email = normalizeNullableEmail(updatePatientDto.email) ?? null;
    identifierUpdates.email = email;
    nextPlainIdentifiers.email = email;
  }
  if (updatePatientDto.contactoEmergenciaNombre !== undefined) {
    const contactoEmergenciaNombre = normalizeNullableString(updatePatientDto.contactoEmergenciaNombre) ?? null;
    identifierUpdates.contactoEmergenciaNombre = contactoEmergenciaNombre;
    nextPlainIdentifiers.contactoEmergenciaNombre = contactoEmergenciaNombre;
  }
  if (updatePatientDto.contactoEmergenciaTelefono !== undefined) {
    const contactoEmergenciaTelefono = normalizeNullableString(updatePatientDto.contactoEmergenciaTelefono) ?? null;
    identifierUpdates.contactoEmergenciaTelefono = contactoEmergenciaTelefono;
    nextPlainIdentifiers.contactoEmergenciaTelefono = contactoEmergenciaTelefono;
  }
  if (updatePatientDto.legalRepresentativeName !== undefined) {
    const val = normalizeNullableString(updatePatientDto.legalRepresentativeName) ?? null;
    identifierUpdates.legalRepresentativeName = val;
    nextPlainIdentifiers.legalRepresentativeName = val;
  }
  if (updatePatientDto.legalRepresentativeRut !== undefined) {
    const val = updatePatientDto.legalRepresentativeRut?.trim() || null;
    identifierUpdates.legalRepresentativeRut = val;
    nextPlainIdentifiers.legalRepresentativeRut = val;
  }
  if (updatePatientDto.legalRepresentativeRelationship !== undefined) {
    const val = normalizeNullableString(updatePatientDto.legalRepresentativeRelationship) ?? null;
    identifierUpdates.legalRepresentativeRelationship = val;
    nextPlainIdentifiers.legalRepresentativeRelationship = val;
  }
  if (updatePatientDto.legalRepresentativeContact !== undefined) {
    const val = normalizeNullableString(updatePatientDto.legalRepresentativeContact) ?? null;
    identifierUpdates.legalRepresentativeContact = val;
    nextPlainIdentifiers.legalRepresentativeContact = val;
  }

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

    identifierUpdates.rut = null;
    nextPlainIdentifiers.rut = null;
    updateData.rutExempt = true;
    updateData.rutExemptReason = reason;
  } else if (dtoRutExempt === false) {
    updateData.rutExemptReason = null;
  }

  const dtoRut = updatePatientDto.rut;
  if (!nextRutExempt && dtoRut !== undefined) {
    const trimmedRut = dtoRut?.trim() || '';

    if (!trimmedRut) {
      identifierUpdates.rut = null;
      nextPlainIdentifiers.rut = null;
    } else if (trimmedRut !== currentIdentifiers.rut) {
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
        throw new ConflictException({ code: 'DUPLICATE_RUT_CONFLICT', message: 'Ya existe un paciente registrado con este RUT.' });
      }

      identifierUpdates.rut = validatedRut;
      nextPlainIdentifiers.rut = validatedRut;
    }
  }

  assignEncryptedIdentifierUpdates(updateData, identifierUpdates);

  const nextPatient = {
    ...existingPatient,
    ...currentIdentifiers,
    ...updateData,
    ...nextPlainIdentifiers,
  };

  Object.assign(
    updateData,
    resolvePatientVerificationState({
      currentPatient: { ...existingPatient, ...currentIdentifiers },
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

export { updatePatientAdminDemographicsMutation } from './patients-demographics-admin-mutation';
