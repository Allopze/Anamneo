import { BadRequestException, ConflictException } from '@nestjs/common';
import { validateRut } from '../common/utils/helpers';
import { PrismaService } from '../prisma/prisma.service';

interface ResolveCreatePatientRutInputParams {
  prisma: PrismaService;
  rut?: string;
  rutExempt?: boolean;
  rutExemptReason?: string;
  invalidRutMessage: string;
  missingExemptReasonMessage: string;
}

export function resolvePatientRutState(params: {
  rut?: string;
  rutExempt?: boolean;
  formattedRut?: string;
  trimmedRutExemptReason?: string;
}) {
  const { rut, rutExempt, formattedRut, trimmedRutExemptReason } = params;

  return {
    rut: rutExempt ? null : formattedRut || rut || null,
    rutExempt: rutExempt || false,
    rutExemptReason: trimmedRutExemptReason || null,
  };
}

export async function resolveCreatePatientRutInput(params: ResolveCreatePatientRutInputParams) {
  const {
    prisma,
    rut,
    rutExempt,
    rutExemptReason,
    invalidRutMessage,
    missingExemptReasonMessage,
  } = params;

  let formattedRut: string | undefined;
  const trimmedRutExemptReason = rutExemptReason?.trim();

  if (rut && !rutExempt) {
    const rutValidation = validateRut(rut);
    if (!rutValidation.valid) {
      throw new BadRequestException(invalidRutMessage);
    }

    const validatedRut = rutValidation.formatted as string;

    const existingPatient = await prisma.patient.findFirst({
      where: {
        rut: validatedRut,
      },
    });

    if (existingPatient) {
      throw new ConflictException('Ya existe un paciente con este RUT');
    }

    formattedRut = validatedRut;
  }

  if (rutExempt && !trimmedRutExemptReason) {
    throw new BadRequestException(missingExemptReasonMessage);
  }

  return {
    formattedRut,
    trimmedRutExemptReason,
  };
}