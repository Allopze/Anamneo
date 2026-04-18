import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildEncounterTaskScopeWhere, buildPatientProblemScopeWhere } from '../common/utils/patient-access';
import { RequestUser } from '../common/utils/medico-id';
import { canAccessEncounter } from './encounter-policy';
import { formatEncounterForList, formatEncounterForPatientList, formatEncounterResponse } from './encounters-presenters';

interface FindEncountersReadModelParams {
  prisma: PrismaService;
  effectiveMedicoId: string;
  status?: string;
  search?: string;
  reviewStatus?: string;
  page: number;
  limit: number;
}

export async function findEncountersReadModel(params: FindEncountersReadModelParams) {
  const { prisma, effectiveMedicoId, status, search, reviewStatus, page, limit } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    medicoId: effectiveMedicoId,
    patient: {
      archivedAt: null,
    },
  };

  if (status && ['EN_PROGRESO', 'COMPLETADO', 'FIRMADO', 'CANCELADO'].includes(status)) {
    where.status = status;
  }

  if (reviewStatus && ['NO_REQUIERE_REVISION', 'LISTA_PARA_REVISION', 'REVISADA_POR_MEDICO'].includes(reviewStatus)) {
    where.reviewStatus = reviewStatus;
  }

  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    where.OR = [
      { patient: { nombre: { contains: trimmedSearch } } },
      { patient: { rut: { contains: trimmedSearch } } },
    ];
  }

  const [encounters, total] = await Promise.all([
    prisma.encounter.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        createdBy: {
          select: { id: true, nombre: true },
        },
        reviewRequestedBy: {
          select: { id: true, nombre: true },
        },
        reviewedBy: {
          select: { id: true, nombre: true },
        },
        completedBy: {
          select: { id: true, nombre: true },
        },
        sections: {
          select: { completed: true },
        },
      },
    }),
    prisma.encounter.count({ where }),
  ]);

  return {
    data: encounters.map((encounter) => formatEncounterForList(encounter)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

interface FindEncounterByIdReadModelParams {
  prisma: PrismaService;
  id: string;
  effectiveMedicoId: string;
  user: RequestUser;
}

export async function findEncounterByIdReadModel(params: FindEncounterByIdReadModelParams) {
  const { prisma, id, effectiveMedicoId, user } = params;

  const encounter = await prisma.encounter.findFirst({
    where: {
      id,
      medicoId: effectiveMedicoId,
    },
    include: {
      sections: {
        orderBy: { sectionKey: 'asc' },
      },
      patient: {
        include: {
          history: true,
          problems: {
            where: buildPatientProblemScopeWhere(effectiveMedicoId),
            orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
          },
          tasks: {
            where: buildEncounterTaskScopeWhere(effectiveMedicoId),
            orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
            include: {
              createdBy: { select: { id: true, nombre: true } },
            },
          },
        },
      },
      createdBy: {
        select: { id: true, nombre: true, email: true },
      },
      reviewRequestedBy: {
        select: { id: true, nombre: true },
      },
      reviewedBy: {
        select: { id: true, nombre: true },
      },
      completedBy: {
        select: { id: true, nombre: true },
      },
      suggestions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      attachments: {
        where: { deletedAt: null },
        orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
      },
      tasks: {
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          createdBy: { select: { id: true, nombre: true } },
        },
      },
    },
  });

  if (!encounter) {
    throw new NotFoundException('Atención no encontrada');
  }

  if (!canAccessEncounter(user, encounter.medicoId)) {
    throw new NotFoundException('Atención no encontrada');
  }

  const signatureBaseline = await prisma.encounter.findFirst({
    where: {
      patientId: encounter.patientId,
      medicoId: effectiveMedicoId,
      id: { not: encounter.id },
      status: { in: ['COMPLETADO', 'FIRMADO'] },
      createdAt: { lt: encounter.createdAt },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      sections: {
        orderBy: { sectionKey: 'asc' },
      },
      attachments: {
        where: { deletedAt: null },
        orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
      },
    },
  });

  return formatEncounterResponse(
    {
      ...encounter,
      signatureBaseline,
    },
    { viewerRole: user.role },
  );
}

interface FindEncountersByPatientReadModelParams {
  prisma: PrismaService;
  patientId: string;
  effectiveMedicoId: string;
}

export async function findEncountersByPatientReadModel(params: FindEncountersByPatientReadModelParams) {
  const { prisma, patientId, effectiveMedicoId } = params;

  const encounters = await prisma.encounter.findMany({
    where: {
      patientId,
      medicoId: effectiveMedicoId,
      patient: {
        archivedAt: null,
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        select: { id: true, nombre: true },
      },
      reviewRequestedBy: {
        select: { id: true, nombre: true },
      },
      reviewedBy: {
        select: { id: true, nombre: true },
      },
      completedBy: {
        select: { id: true, nombre: true },
      },
      sections: {
        select: { sectionKey: true, completed: true },
      },
    },
  });

  return encounters.map((encounter) => formatEncounterForPatientList(encounter));
}
