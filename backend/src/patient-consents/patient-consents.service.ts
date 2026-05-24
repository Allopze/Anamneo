import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GrantPatientDataConsentDto } from './dto/patient-consent.dto';
import { RequestUser } from '../common/utils/medico-id';
import { decryptField, decryptNetMeta, encryptField, encryptNetMeta } from '../common/utils/field-crypto';
import { computeRutLookupHash } from '../patients/patients-identifiers';
import { assertLoadedPatientAccess, assertPatientAccess } from '../common/utils/patient-access';

/**
 * Servicio del consentimiento del TITULAR para el tratamiento de datos
 * personales (Ley 21.719 Art 12). Distinto del ClinicalConsent que
 * registra consentimientos clinicos otorgados por el medico.
 */
@Injectable()
export class PatientConsentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Verifica si existe un consentimiento vigente del titular para una
   * finalidad dada sobre la version publicada vigente de la politica de
   * privacidad. Usado por PolicyComplianceService.
   */
  async hasVigentConsentForActivePrivacyPolicy(
    patientId: string,
    purpose: string,
  ): Promise<boolean> {
    const activePrivacy = await this.prisma.legalDocument.findFirst({
      where: { type: 'PRIVACY', status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      select: { id: true },
    });
    if (!activePrivacy) return false;
    const consent = await this.prisma.patientDataProcessingConsent.findFirst({
      where: {
        patientId,
        purpose,
        legalDocumentId: activePrivacy.id,
        revokedAt: null,
        granted: true,
      },
      select: { id: true },
    });
    return !!consent;
  }

  async listForPatient(patientId: string, user: RequestUser) {
    await assertPatientAccess(this.prisma, user, patientId);

    const consentsRaw = await this.prisma.patientDataProcessingConsent.findMany({
      where: { patientId },
      orderBy: { grantedAt: 'desc' },
      include: {
        legalDocument: { select: { id: true, type: true, version: true, title: true } },
        capturedBy: { select: { id: true, nombre: true } },
      },
    });
    // Ley 21.719 Art 14 quinquies lit a — descifrar metadatos de red y firmante al
    // exponerlos al UI admin (cifrados at-rest desde el write).
    const consents = consentsRaw.map((c) => ({
      ...c,
      capturedIp: decryptNetMeta(c.capturedIp),
      capturedUserAgent: decryptNetMeta(c.capturedUserAgent),
      // Phase E — descifrar firmante; fallback a plaintext durante ventana de backfill
      signerName: (c.signerNameEnc ? decryptField(c.signerNameEnc) : null) ?? c.signerName,
      signerRut: c.signerRutEnc ? decryptField(c.signerRutEnc) : c.signerRut,
    }));

    await this.audit.log({
      entityType: 'PatientDataProcessingConsent',
      entityId: patientId,
      userId: user.id,
      action: 'READ',
      diff: { scope: 'LIST', count: consents.length },
    });

    return consents;
  }

  async grant(dto: GrantPatientDataConsentDto, user: RequestUser, requestMeta: { ip?: string; userAgent?: string }) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
      select: {
        id: true,
        fechaNacimiento: true,
        createdById: true,
        archivedAt: true,
        createdBy: { select: { medicoId: true } },
      },
    });
    const scopedPatient = await assertLoadedPatientAccess(this.prisma, user, dto.patientId, patient);

    const legalDocument = await this.prisma.legalDocument.findUnique({
      where: { id: dto.legalDocumentId },
      select: { id: true, type: true, status: true, version: true },
    });
    if (!legalDocument) throw new NotFoundException('Documento legal no encontrado');
    if (legalDocument.type !== 'PRIVACY') {
      throw new BadRequestException('legalDocumentId debe referenciar una Politica de Privacidad');
    }
    if (legalDocument.status !== 'PUBLISHED') {
      throw new BadRequestException('La politica referenciada no esta publicada');
    }

    // Ley 21.719 Art 16 quater - validacion NNA
    this.assertNNAConsentValid(scopedPatient.fechaNacimiento, dto);

    const evidencePayload = {
      patientId: dto.patientId,
      legalDocumentId: dto.legalDocumentId,
      legalDocumentVersion: legalDocument.version,
      purpose: dto.purpose,
      method: dto.method,
      signerName: dto.signerName,
      signerRut: dto.signerRut ?? null,
      signerRelationship: dto.signerRelationship,
      capturedAt: new Date().toISOString(),
      capturedIp: requestMeta.ip ?? null,
      capturedUserAgent: requestMeta.userAgent ?? null,
      language: dto.language ?? 'es-CL',
      sessionId: dto.sessionId ?? null,
      clinicId: dto.clinicId ?? null,
      consentPayloadSnapshot: dto.consentPayloadSnapshot ?? null,
    };
    const evidenceHash = createHash('sha256').update(JSON.stringify(evidencePayload)).digest('hex');

    const created = await this.prisma.patientDataProcessingConsent.create({
      data: {
        patientId: dto.patientId,
        legalDocumentId: dto.legalDocumentId,
        purpose: dto.purpose,
        granted: true,
        method: dto.method,
        // Ley 21.719 Art 14 quinquies — cifrado app-level de IP/UA.
        capturedIp: encryptNetMeta(requestMeta.ip),
        capturedUserAgent: encryptNetMeta(requestMeta.userAgent),
        capturedByUserId: dto.method === 'WEB_TITULAR' ? null : user.id,
        signerName: dto.signerName,
        signerRut: dto.signerRut,
        // Phase E — cifrado app-level del firmante
        signerNameEnc: encryptField(dto.signerName),
        signerRutEnc: dto.signerRut ? encryptField(dto.signerRut) : null,
        signerRutLookupHash: computeRutLookupHash(dto.signerRut ?? null),
        signerRelationship: dto.signerRelationship,
        evidenceHash,
        language: dto.language ?? 'es-CL',
        sessionId: dto.sessionId,
        clinicId: dto.clinicId,
        representativeBondEvidenceRef: dto.representativeBondEvidenceRef,
        consentPayloadSnapshot: (dto.consentPayloadSnapshot ?? null) as never,
      },
    });

    await this.audit.log({
      entityType: 'PatientDataProcessingConsent',
      entityId: created.id,
      userId: user.id,
      action: 'CREATE',
      diff: {
        patientId: dto.patientId,
        purpose: dto.purpose,
        method: dto.method,
        signerRelationship: dto.signerRelationship,
        legalDocumentVersion: legalDocument.version,
        evidenceHash,
      },
    });

    return created;
  }

  async revoke(consentId: string, reason: string, user: RequestUser, channel?: string) {
    const consent = await this.prisma.patientDataProcessingConsent.findUnique({
      where: { id: consentId },
      select: { id: true, patientId: true, revokedAt: true, purpose: true },
    });
    if (!consent) throw new NotFoundException('Consentimiento no encontrado');
    await assertPatientAccess(this.prisma, user, consent.patientId);
    if (consent.revokedAt) {
      throw new BadRequestException('El consentimiento ya esta revocado');
    }

    const updated = await this.prisma.patientDataProcessingConsent.update({
      where: { id: consentId },
      data: {
        revokedAt: new Date(),
        granted: false,
        revokedReason: reason.slice(0, 1000),
        revokedChannel: channel ?? null,
      },
    });

    await this.audit.log({
      entityType: 'PatientDataProcessingConsent',
      entityId: consentId,
      userId: user.id,
      action: 'UPDATE',
      reason: 'PATIENT_DATA_CONSENT_REVOKED',
      diff: {
        patientId: consent.patientId,
        purpose: consent.purpose,
        revokedReason: reason.slice(0, 200),
        revokedChannel: channel ?? null,
      },
    });

    return updated;
  }

  /**
   * Ley 21.719 Art 16 quater. Niños (<14 años): requieren consentimiento
   * de padre, madre, tutor o representante. Adolescentes (14-18) pueden
   * consentir por si mismos para tratamientos no sensibles.
   *
   * Anamneo trata datos sensibles por construccion, por lo que
   * adolescentes menores de 16 anos requieren consentimiento de
   * padre/madre/tutor para datos sensibles.
   *
   * NOTA LEGAL: criterios precisos pendientes de validacion por asesor
   * (ver docs/preguntas-abogado-ley21719.md §2.3).
   */
  private assertNNAConsentValid(fechaNacimiento: Date | null, dto: GrantPatientDataConsentDto) {
    if (!fechaNacimiento) return;
    const ageYears = (Date.now() - fechaNacimiento.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const requiresRepresentative = ageYears < 16; // conservador: dato sensible
    if (!requiresRepresentative) return;
    if (dto.signerRelationship === 'TITULAR') {
      throw new BadRequestException(
        `Paciente menor de 16 anos: el consentimiento de tratamiento de datos sensibles ` +
        `debe ser otorgado por padre, madre, tutor o representante legal ` +
        `(Ley 21.719 Art 16 quater). Recibido: signerRelationship=TITULAR.`,
      );
    }
  }
}
