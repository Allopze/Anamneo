import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/utils/medico-id';
import { UpdatePatientAdminDto } from './dto/update-patient-admin.dto';
import { normalizeNullableEmail, normalizeNullableString, resolvePatientVerificationState } from './patients-format';
import { applySharedDemographicFields, assignEncryptedIdentifierUpdates } from './patients-demographics-mutations.helpers';
import { resolvePatientIdentifiers } from './patients-identifiers';

type ExistingPatient = any;

interface UpdatePatientAdminDemographicsMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  patientId: string;
  dto: UpdatePatientAdminDto;
  user: RequestUser;
  assertPatientAccess: (user: RequestUser, patientId: string) => Promise<ExistingPatient>;
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
  const currentIdentifiers = resolvePatientIdentifiers(existingPatient);
  const identifierUpdates: Parameters<typeof assignEncryptedIdentifierUpdates>[1] = {};
  const nextPlainIdentifiers = { ...currentIdentifiers };

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

  if (dto.domicilio !== undefined) {
    const domicilio = normalizeNullableString(dto.domicilio) ?? null;
    identifierUpdates.domicilio = domicilio;
    nextPlainIdentifiers.domicilio = domicilio;
  }
  if (dto.telefono !== undefined) {
    const telefono = normalizeNullableString(dto.telefono) ?? null;
    identifierUpdates.telefono = telefono;
    nextPlainIdentifiers.telefono = telefono;
  }
  if (dto.email !== undefined) {
    const email = normalizeNullableEmail(dto.email) ?? null;
    identifierUpdates.email = email;
    nextPlainIdentifiers.email = email;
  }
  if (dto.contactoEmergenciaNombre !== undefined) {
    const contactoEmergenciaNombre = normalizeNullableString(dto.contactoEmergenciaNombre) ?? null;
    identifierUpdates.contactoEmergenciaNombre = contactoEmergenciaNombre;
    nextPlainIdentifiers.contactoEmergenciaNombre = contactoEmergenciaNombre;
  }
  if (dto.contactoEmergenciaTelefono !== undefined) {
    const contactoEmergenciaTelefono = normalizeNullableString(dto.contactoEmergenciaTelefono) ?? null;
    identifierUpdates.contactoEmergenciaTelefono = contactoEmergenciaTelefono;
    nextPlainIdentifiers.contactoEmergenciaTelefono = contactoEmergenciaTelefono;
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
