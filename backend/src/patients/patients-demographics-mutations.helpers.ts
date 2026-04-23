import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isDateOnlyAfterToday, calculateAgeFromBirthDate, parseDateOnlyToStoredUtcDate } from '../common/utils/local-date';
import { normalizeNullableEmail, normalizeNullableString } from './patients-format';

export async function findDuplicateRut(prisma: PrismaService, params: { rut: string; excludePatientId?: string }) {
  const { rut, excludePatientId } = params;

  return prisma.patient.findFirst({
    where: {
      rut,
      ...(excludePatientId ? { id: { not: excludePatientId } } : {}),
    },
  });
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
    domicilio,
    telefono,
    email,
    contactoEmergenciaNombre,
    contactoEmergenciaTelefono,
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

  if (domicilio !== undefined) {
    updateData.domicilio = normalizeNullableString(domicilio);
  }

  if (telefono !== undefined) {
    updateData.telefono = normalizeNullableString(telefono);
  }

  if (email !== undefined) {
    updateData.email = normalizeNullableEmail(email);
  }

  if (contactoEmergenciaNombre !== undefined) {
    updateData.contactoEmergenciaNombre = normalizeNullableString(contactoEmergenciaNombre);
  }

  if (contactoEmergenciaTelefono !== undefined) {
    updateData.contactoEmergenciaTelefono = normalizeNullableString(contactoEmergenciaTelefono);
  }

  if (centroMedico !== undefined) {
    updateData.centroMedico = normalizeNullableString(centroMedico);
  }
}
