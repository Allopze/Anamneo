import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreatePatientQuickDto } from './dto/create-patient-quick.dto';
import { RequestUser } from '../common/utils/medico-id';
import { isDateOnlyAfterToday, calculateAgeFromBirthDate } from '../common/utils/local-date';
import { decoratePatient, resolvePatientVerificationState } from './patients-format';
import { resolveCreatePatientRutInput, resolvePatientRutState } from './patients-create-utils';

interface CreatePatientMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  createPatientDto: CreatePatientDto;
  userId: string;
}

interface CreatePatientQuickMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  createPatientDto: CreatePatientQuickDto;
  user: RequestUser;
}

export async function createPatientMutation(params: CreatePatientMutationParams) {
  const { prisma, auditService, createPatientDto, userId } = params;

  const { formattedRut, trimmedRutExemptReason } = await resolveCreatePatientRutInput({
    prisma,
    rut: createPatientDto.rut,
    rutExempt: createPatientDto.rutExempt,
    rutExemptReason: createPatientDto.rutExemptReason,
    invalidRutMessage: 'El RUT ingresado no es válido',
    missingExemptReasonMessage: 'Debe indicar el motivo de exención de RUT',
  });
  const resolvedRut = resolvePatientRutState({
    rut: createPatientDto.rut,
    rutExempt: createPatientDto.rutExempt,
    formattedRut,
    trimmedRutExemptReason,
  });

  const verificationState = resolvePatientVerificationState({
    actorId: userId,
    actorRole: 'MEDICO',
    mode: 'CREATE_FULL',
    nextPatient: {
      rut: resolvedRut.rut,
      rutExempt: resolvedRut.rutExempt,
      rutExemptReason: resolvedRut.rutExemptReason,
      edad: createPatientDto.edad,
      sexo: createPatientDto.sexo,
      prevision: createPatientDto.prevision,
    },
  });

  if (createPatientDto.fechaNacimiento && isDateOnlyAfterToday(createPatientDto.fechaNacimiento)) {
    throw new BadRequestException('La fecha de nacimiento no puede ser futura');
  }

  const resolvedAge = createPatientDto.fechaNacimiento
    ? calculateAgeFromBirthDate(createPatientDto.fechaNacimiento)
    : { edad: createPatientDto.edad, edadMeses: createPatientDto.edadMeses ?? null };

  const patient = await prisma.patient.create({
    data: {
      createdById: userId,
      rut: resolvedRut.rut,
      rutExempt: resolvedRut.rutExempt,
      rutExemptReason: resolvedRut.rutExemptReason,
      nombre: createPatientDto.nombre,
      fechaNacimiento: createPatientDto.fechaNacimiento ? new Date(createPatientDto.fechaNacimiento) : null,
      edad: resolvedAge.edad,
      edadMeses: resolvedAge.edadMeses ?? null,
      sexo: createPatientDto.sexo,
      trabajo: createPatientDto.trabajo,
      prevision: createPatientDto.prevision,
      domicilio: createPatientDto.domicilio,
      centroMedico: createPatientDto.centroMedico,
      registrationMode: 'COMPLETO',
      ...verificationState,
      history: {
        create: {},
      },
    },
    include: {
      history: true,
    },
  });

  await auditService.log({
    entityType: 'Patient',
    entityId: patient.id,
    userId,
    action: 'CREATE',
    diff: { created: patient },
  });

  return decoratePatient(patient);
}

export async function createQuickPatientMutation(params: CreatePatientQuickMutationParams) {
  const { prisma, auditService, createPatientDto, user } = params;

  const { formattedRut, trimmedRutExemptReason } = await resolveCreatePatientRutInput({
    prisma,
    rut: createPatientDto.rut,
    rutExempt: createPatientDto.rutExempt,
    rutExemptReason: createPatientDto.rutExemptReason,
    invalidRutMessage: 'El RUT ingresado no es valido',
    missingExemptReasonMessage: 'Debe indicar el motivo de exencion de RUT',
  });
  const resolvedRut = resolvePatientRutState({
    rut: createPatientDto.rut,
    rutExempt: createPatientDto.rutExempt,
    formattedRut,
    trimmedRutExemptReason,
  });

  const patient = await prisma.patient.create({
    data: {
      createdById: user.id,
      rut: resolvedRut.rut,
      rutExempt: resolvedRut.rutExempt,
      rutExemptReason: resolvedRut.rutExemptReason,
      nombre: createPatientDto.nombre,
      edad: null,
      sexo: null,
      prevision: null,
      trabajo: null,
      domicilio: null,
      registrationMode: 'RAPIDO',
      ...resolvePatientVerificationState({
        actorId: user.id,
        actorRole: user.role,
        mode: 'CREATE_QUICK',
        nextPatient: {
          rut: resolvedRut.rut,
          rutExempt: resolvedRut.rutExempt,
          rutExemptReason: resolvedRut.rutExemptReason,
        },
      }),
      history: {
        create: {},
      },
    },
    include: { history: true },
  });

  await auditService.log({
    entityType: 'Patient',
    entityId: patient.id,
    userId: user.id,
    action: 'CREATE',
    diff: { created: patient, quick: true },
  });

  return decoratePatient(patient);
}
