import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { endOfAppDayUtcExclusive, extractDateOnlyIso, startOfAppDayUtc } from '../common/utils/local-date';
import { RequestUser } from '../common/utils/medico-id';
import { toCsvCell } from './patients-format';
import { PATIENT_ENCRYPTED_IDENTIFIER_SELECT, resolvePatientIdentifiers } from './patients-identifiers';
import { PrismaService } from '../prisma/prisma.service';

const MAX_EXPORT_DAYS = 370;

export interface OperationalEncountersExportFilters {
  fromDate: string;
  toDate: string;
  medicoId?: string;
}

interface ExportOperationalEncountersCsvParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  filters: OperationalEncountersExportFilters;
}

function parseExportWindow(filters: OperationalEncountersExportFilters) {
  if (!filters.fromDate?.trim() || !filters.toDate?.trim()) {
    throw new BadRequestException('fromDate y toDate son requeridos');
  }

  const fromDate = extractDateOnlyIso(filters.fromDate, 'Fecha desde');
  const toDate = extractDateOnlyIso(filters.toDate, 'Fecha hasta');
  if (fromDate > toDate) {
    throw new BadRequestException('Fecha desde no puede ser posterior a fecha hasta');
  }

  const from = startOfAppDayUtc(fromDate);
  const toExclusive = endOfAppDayUtcExclusive(toDate);
  const days = Math.ceil((toExclusive.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (days > MAX_EXPORT_DAYS) {
    throw new BadRequestException(`El rango de exportacion no puede superar ${MAX_EXPORT_DAYS} dias`);
  }

  return { fromDate, toDate, from, toExclusive };
}

function compactLabels(items: Array<{ label: string | null }>) {
  const labels = items.map((item) => item.label?.trim()).filter((item): item is string => Boolean(item));
  return labels.length > 0 ? labels.join(' | ') : null;
}

export async function exportOperationalEncountersCsvReadModel(params: ExportOperationalEncountersCsvParams) {
  const { prisma, auditService, user, filters } = params;
  const { fromDate, toDate, from, toExclusive } = parseExportWindow(filters);
  const medicoId = filters.medicoId?.trim() || undefined;

  const where: Prisma.EncounterWhereInput = {
    createdAt: { gte: from, lt: toExclusive },
    ...(medicoId ? { medicoId } : {}),
    patient: { archivedAt: null },
  };

  const encounters = await prisma.encounter.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      patient: {
        select: {
          ...PATIENT_ENCRYPTED_IDENTIFIER_SELECT,
          edad: true,
          edadMeses: true,
          sexo: true,
          prevision: true,
          registrationMode: true,
          completenessStatus: true,
          rutExempt: true,
          rutExemptReason: true,
        },
      },
      medico: { select: { id: true, nombre: true, email: true } },
      createdBy: { select: { id: true, nombre: true, email: true, role: true } },
      diagnoses: { select: { label: true }, orderBy: { createdAt: 'asc' } },
      treatments: { select: { label: true }, orderBy: { createdAt: 'asc' } },
    },
  });

  const header = [
    'Fecha',
    'Estado',
    'Medico',
    'Email medico',
    'Paciente',
    'RUT',
    'Exento RUT',
    'Edad',
    'Sexo',
    'Prevision',
    'Modo registro',
    'Completitud',
    'Diagnosticos',
    'Tratamientos',
    'Creado por',
  ].join(',');

  const rows = encounters.map((encounter) => {
    const patient = resolvePatientIdentifiers(encounter.patient);
    const fields = [
      encounter.createdAt.toISOString(),
      encounter.status,
      encounter.medico.nombre,
      encounter.medico.email,
      patient.nombre,
      patient.rut,
      encounter.patient.rutExempt ? (encounter.patient.rutExemptReason || 'Si') : 'No',
      encounter.patient.edad ?? encounter.patient.edadMeses,
      encounter.patient.sexo,
      encounter.patient.prevision,
      encounter.patient.registrationMode,
      encounter.patient.completenessStatus,
      compactLabels(encounter.diagnoses),
      compactLabels(encounter.treatments),
      `${encounter.createdBy.nombre} (${encounter.createdBy.role})`,
    ];

    return fields.map((field) => toCsvCell(field)).join(',');
  });

  await auditService.log({
    entityType: 'OperationalEncounterExport',
    entityId: 'csv',
    userId: user.id,
    action: 'EXPORT',
    diff: {
      export: {
        format: 'csv',
        fromDate,
        toDate,
        medicoId: medicoId ?? null,
        encounterCount: encounters.length,
      },
    },
  });

  return '\uFEFF' + header + '\n' + rows.join('\n');
}
