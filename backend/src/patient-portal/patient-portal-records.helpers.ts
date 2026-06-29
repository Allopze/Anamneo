import { NotFoundException } from '@nestjs/common';
import { computeRutLookupHash, resolvePatientIdentifiers, withPatientIdentifiers } from '../patients/patients-identifiers';
import { decryptField, encryptField } from '../common/utils/field-crypto';
import { AuditService } from '../audit/audit.service';
import { EncountersPdfService } from '../encounters/encounters-pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { PortalDataRequestDto } from './dto/patient-portal.dto';
import type { PatientPortalRequestUser } from './patient-portal.types';

const DATA_REQUEST_SLA_DAYS = 30;

function parseSectionData(raw: string): unknown {
  try {
    return JSON.parse(decryptField(raw));
  } catch {
    return { __unavailable: true };
  }
}

export async function getPortalPatient(params: {
  prisma: PrismaService;
  audit: AuditService;
  user: PatientPortalRequestUser;
}) {
  const { prisma, audit, user } = params;
  const patient = await prisma.patient.findUnique({
    where: { id: user.patientId },
    select: {
      id: true,
      rutEnc: true,
      rutExempt: true,
      nombreEnc: true,
      fechaNacimiento: true,
      edad: true,
      edadMeses: true,
      sexo: true,
      prevision: true,
      emailEnc: true,
      telefonoEnc: true,
      legalRepresentativeNameEnc: true,
      legalRepresentativeRelationshipEnc: true,
    },
  });
  if (!patient) throw new NotFoundException('Paciente no encontrado');
  const patientWithIdentifiers = withPatientIdentifiers(patient);
  await audit.log({
    entityType: 'Patient',
    entityId: patient.id,
    userId: `portal:${user.id}`,
    action: 'READ',
    reason: 'PATIENT_PORTAL_RECORD_VIEWED',
  });
  return patientWithIdentifiers;
}

export async function listPortalEncounters(prisma: PrismaService, user: PatientPortalRequestUser) {
  const encounters = await prisma.encounter.findMany({
    where: { patientId: user.patientId, status: { in: ['COMPLETADO', 'FIRMADO'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      status: true,
      reviewStatus: true,
      medico: { select: { nombre: true } },
    },
  });
  return encounters.map((encounter) => ({
    ...encounter,
    fecha: encounter.createdAt,
    tipoAtencion: null,
    motivoConsulta: null,
  }));
}

export async function getPortalEncounter(params: {
  prisma: PrismaService;
  audit: AuditService;
  user: PatientPortalRequestUser;
  encounterId: string;
}) {
  const { prisma, audit, user, encounterId } = params;
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, patientId: user.patientId, status: { in: ['COMPLETADO', 'FIRMADO'] } },
    include: {
      sections: true,
      attachments: {
        where: { deletedAt: null },
        select: { id: true, originalName: true, mime: true, size: true, category: true, uploadedAt: true },
      },
      medico: { select: { nombre: true } },
    },
  });
  if (!encounter) throw new NotFoundException('Atención no encontrada');
  await audit.log({
    entityType: 'Encounter',
    entityId: encounter.id,
    userId: `portal:${user.id}`,
    action: 'READ',
    reason: 'PATIENT_PORTAL_ENCOUNTER_VIEWED',
  });
  return {
    ...encounter,
    fecha: encounter.createdAt,
    tipoAtencion: null,
    motivoConsulta: null,
    sections: encounter.sections.map((section) => ({
      id: section.id,
      sectionKey: section.sectionKey,
      completed: section.completed,
      notApplicable: section.notApplicable,
      data: parseSectionData(section.data),
      updatedAt: section.updatedAt,
    })),
  };
}

export async function exportPortalEncounterPdf(params: {
  prisma: PrismaService;
  audit: AuditService;
  encountersPdf: EncountersPdfService;
  user: PatientPortalRequestUser;
  encounterId: string;
}) {
  const { prisma, audit, encountersPdf, user, encounterId } = params;
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, patientId: user.patientId, status: { in: ['COMPLETADO', 'FIRMADO'] } },
    select: { id: true, medicoId: true },
  });
  if (!encounter) throw new NotFoundException('Atención no encontrada');
  const syntheticUser = {
    id: encounter.medicoId,
    email: user.email,
    nombre: 'Portal paciente',
    role: 'MEDICO',
    isAdmin: false,
  };
  const filename = await encountersPdf.getPdfFilename(encounterId, syntheticUser);
  const buffer = await encountersPdf.generatePdf(encounterId, syntheticUser);
  await audit.log({
    entityType: 'Encounter',
    entityId: encounterId,
    userId: `portal:${user.id}`,
    action: 'EXPORT',
    reason: 'PATIENT_PORTAL_DOCUMENT_DOWNLOADED',
    diff: { patientId: user.patientId },
  });
  return { filename, buffer };
}

export async function createPortalDataRequest(params: {
  prisma: PrismaService;
  audit: AuditService;
  user: PatientPortalRequestUser;
  dto: PortalDataRequestDto;
}) {
  const { prisma, audit, user, dto } = params;
  const patient = await prisma.patient.findUnique({ where: { id: user.patientId } });
  if (!patient) throw new NotFoundException('Paciente no encontrado');
  const patientIdentifiers = resolvePatientIdentifiers(patient);
  const now = new Date();
  const requesterRut = dto.requesterRut ?? patientIdentifiers.rut;
  const created = await prisma.patientDataRequest.create({
    data: {
      patientId: user.patientId,
      requestType: dto.requestType,
      status: 'RECIBIDA',
      submittedBy: user.relationship === 'TITULAR' ? 'TITULAR' : 'REPRESENTANTE',
      requesterNameEnc: encryptField(patientIdentifiers.nombre),
      requesterRutEnc: requesterRut ? encryptField(requesterRut) : null,
      requesterRutLookupHash: computeRutLookupHash(requesterRut),
      requesterEmailEnc: encryptField(user.email),
      payloadRequest: dto.payloadRequest,
      dueDate: new Date(now.getTime() + DATA_REQUEST_SLA_DAYS * 24 * 60 * 60 * 1000),
      identityVerificationMethod: 'PORTAL',
      identityVerificationEvidence: {
        portalAccountId: user.id,
        relationship: user.relationship,
        submittedAt: now.toISOString(),
      },
    },
  });
  await audit.log({
    entityType: 'PatientDataRequest',
    entityId: created.id,
    userId: `portal:${user.id}`,
    action: 'CREATE',
    reason: 'PATIENT_PORTAL_DATA_REQUEST_CREATED',
    diff: { patientId: user.patientId, requestType: dto.requestType },
  });
  return created;
}
