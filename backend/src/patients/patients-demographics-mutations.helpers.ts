import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isDateOnlyAfterToday, calculateAgeFromBirthDate, parseDateOnlyToStoredUtcDate } from '../common/utils/local-date';
import { normalizeNullableString } from './patients-format';
import { buildEncryptedPatientIdentifierFields, computeRutLookupHash } from './patients-identifiers';

export async function findDuplicateRut(prisma: PrismaService, params: { rut: string; excludePatientId?: string }) {
  const { rut, excludePatientId } = params;

  return prisma.patient.findFirst({
    where: {
      rutLookupHash: computeRutLookupHash(rut),
      ...(excludePatientId ? { id: { not: excludePatientId } } : {}),
    },
  });
}

export function assignEncryptedIdentifierUpdates(
  updateData: Prisma.PatientUpdateInput,
  input: {
    rut?: string | null;
    nombre?: string | null;
    domicilio?: string | null;
    telefono?: string | null;
    email?: string | null;
    contactoEmergenciaNombre?: string | null;
    contactoEmergenciaTelefono?: string | null;
    legalRepresentativeName?: string | null;
    legalRepresentativeRut?: string | null;
    legalRepresentativeRelationship?: string | null;
    legalRepresentativeContact?: string | null;
  },
) {
  const encrypted = buildEncryptedPatientIdentifierFields(input);

  if (Object.prototype.hasOwnProperty.call(input, 'rut')) {
    updateData.rutEnc = encrypted.rutEnc;
    updateData.rutLookupHash = encrypted.rutLookupHash;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'nombre')) updateData.nombreEnc = encrypted.nombreEnc;
  if (Object.prototype.hasOwnProperty.call(input, 'domicilio')) updateData.domicilioEnc = encrypted.domicilioEnc;
  if (Object.prototype.hasOwnProperty.call(input, 'telefono')) updateData.telefonoEnc = encrypted.telefonoEnc;
  if (Object.prototype.hasOwnProperty.call(input, 'email')) updateData.emailEnc = encrypted.emailEnc;
  if (Object.prototype.hasOwnProperty.call(input, 'contactoEmergenciaNombre')) {
    updateData.contactoEmergenciaNombreEnc = encrypted.contactoEmergenciaNombreEnc;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'contactoEmergenciaTelefono')) {
    updateData.contactoEmergenciaTelefonoEnc = encrypted.contactoEmergenciaTelefonoEnc;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'legalRepresentativeName')) {
    updateData.legalRepresentativeNameEnc = encrypted.legalRepresentativeNameEnc;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'legalRepresentativeRut')) {
    updateData.legalRepresentativeRutEnc = encrypted.legalRepresentativeRutEnc;
    updateData.legalRepresentativeRutLookupHash = encrypted.legalRepresentativeRutLookupHash;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'legalRepresentativeRelationship')) {
    updateData.legalRepresentativeRelationshipEnc = encrypted.legalRepresentativeRelationshipEnc;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'legalRepresentativeContact')) {
    updateData.legalRepresentativeContactEnc = encrypted.legalRepresentativeContactEnc;
  }
}

export function applySharedDemographicFields(
  updateData: Prisma.PatientUpdateInput,
  params: {
    fechaNacimiento?: string | null;
    edad?: number | null;
    edadMeses?: number | null;
    sexo?: string | null;
    prevision?: string | null;
    trabajo?: string | null;
    domicilio?: string | null;
    telefono?: string | null;
    email?: string | null;
    contactoEmergenciaNombre?: string | null;
    contactoEmergenciaTelefono?: string | null;
    centroMedico?: string | null;
  },
) {
  const {
    fechaNacimiento,
    edad,
    edadMeses,
    sexo,
    prevision,
    trabajo,
    centroMedico,
  } = params;

  if (fechaNacimiento !== undefined) {
    if (fechaNacimiento && isDateOnlyAfterToday(fechaNacimiento)) {
      throw new BadRequestException('La fecha de nacimiento no puede ser futura');
    }

    updateData.fechaNacimiento = fechaNacimiento
      ? parseDateOnlyToStoredUtcDate(fechaNacimiento, 'La fecha de nacimiento')
      : null;

    if (fechaNacimiento) {
      const recalc = calculateAgeFromBirthDate(fechaNacimiento);
      updateData.edad = recalc.edad;
      updateData.edadMeses = recalc.edadMeses;
    }
  }

  if (fechaNacimiento === undefined && edad !== undefined) {
    updateData.edad = edad;
  }

  if (fechaNacimiento === undefined && edadMeses !== undefined) {
    updateData.edadMeses = edadMeses;
  }

  if (sexo !== undefined) {
    updateData.sexo = sexo;
  }

  if (prevision !== undefined) {
    updateData.prevision = prevision;
  }

  if (trabajo !== undefined) {
    updateData.trabajo = normalizeNullableString(trabajo);
  }

  if (centroMedico !== undefined) {
    updateData.centroMedico = normalizeNullableString(centroMedico);
  }
}
