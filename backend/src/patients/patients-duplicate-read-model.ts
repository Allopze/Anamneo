import { Prisma } from '@prisma/client';
import { validateRut } from '../common/utils/helpers';
import { buildAccessiblePatientsWhere } from '../common/utils/patient-access';
import { RequestUser } from '../common/utils/medico-id';
import { PrismaService } from '../prisma/prisma.service';

export type PossiblePatientDuplicateMatchReason = 'same_rut' | 'same_name_birth_date';

export type PossiblePatientDuplicate = {
  id: string;
  nombre: string;
  rut: string | null;
  fechaNacimiento: string | null;
  registrationMode: string;
  completenessStatus: string;
  matchReasons: PossiblePatientDuplicateMatchReason[];
};

interface FindPossiblePatientDuplicatesParams {
  prisma: PrismaService;
  user: RequestUser;
  rut?: string;
  nombre?: string;
  fechaNacimiento?: string;
  excludePatientId?: string;
  limit?: number;
}

function normalizePatientName(value: string | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function resolveRutForDuplicateSearch(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const validation = validateRut(trimmed);
  if (!validation.valid || !validation.formatted) {
    return null;
  }

  return validation.formatted;
}

function buildBirthDateRange(fechaNacimiento: string | undefined): { gte: Date; lt: Date } | null {
  if (!fechaNacimiento) {
    return null;
  }

  const start = new Date(`${fechaNacimiento}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime())) {
    return null;
  }

  return {
    gte: start,
    lt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}

function toDateOnly(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

export async function findPossiblePatientDuplicatesReadModel(
  params: FindPossiblePatientDuplicatesParams,
): Promise<PossiblePatientDuplicate[]> {
  const {
    prisma,
    user,
    rut,
    nombre,
    fechaNacimiento,
    excludePatientId,
    limit = 5,
  } = params;

  const normalizedRut = resolveRutForDuplicateSearch(rut);
  const normalizedName = normalizePatientName(nombre);
  const birthDateRange = buildBirthDateRange(fechaNacimiento);
  const canMatchByNameAndBirthDate = normalizedName.length >= 3 && Boolean(birthDateRange);

  if (!normalizedRut && !canMatchByNameAndBirthDate) {
    return [];
  }

  const duplicateClauses: Prisma.PatientWhereInput[] = [];

  if (normalizedRut) {
    duplicateClauses.push({ rut: normalizedRut });
  }

  if (canMatchByNameAndBirthDate && birthDateRange) {
    duplicateClauses.push({ fechaNacimiento: birthDateRange });
  }

  const candidates = await prisma.patient.findMany({
    where: {
      AND: [
        buildAccessiblePatientsWhere(user),
        excludePatientId ? { id: { not: excludePatientId } } : {},
        { OR: duplicateClauses },
      ],
    },
    select: {
      id: true,
      nombre: true,
      rut: true,
      fechaNacimiento: true,
      registrationMode: true,
      completenessStatus: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  return candidates
    .map((candidate) => {
      const candidateDateOnly = toDateOnly(candidate.fechaNacimiento);
      const matchReasons: PossiblePatientDuplicateMatchReason[] = [];

      if (normalizedRut && candidate.rut === normalizedRut) {
        matchReasons.push('same_rut');
      }

      if (
        canMatchByNameAndBirthDate
        && candidateDateOnly === fechaNacimiento
        && normalizePatientName(candidate.nombre) === normalizedName
      ) {
        matchReasons.push('same_name_birth_date');
      }

      return {
        id: candidate.id,
        nombre: candidate.nombre,
        rut: candidate.rut,
        fechaNacimiento: candidateDateOnly,
        registrationMode: candidate.registrationMode,
        completenessStatus: candidate.completenessStatus,
        matchReasons,
      };
    })
    .filter((candidate) => candidate.matchReasons.length > 0)
    .sort((left, right) => right.matchReasons.length - left.matchReasons.length);
}