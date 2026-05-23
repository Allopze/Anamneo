import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PatientConsentsService } from './patient-consents.service';

describe('PatientConsentsService', () => {
  const baseUser = { id: 'user-1' } as never;
  const requestMeta = { ip: '127.0.0.1', userAgent: 'jest' };

  function buildService(overrides?: {
    findPatient?: jest.Mock;
    findLegal?: jest.Mock;
    findFirstLegal?: jest.Mock;
    findFirstConsent?: jest.Mock;
    findManyConsents?: jest.Mock;
    createConsent?: jest.Mock;
    findUniqueConsent?: jest.Mock;
    updateConsent?: jest.Mock;
    auditLog?: jest.Mock;
  }) {
    const findPatient = overrides?.findPatient ?? jest.fn();
    const findLegal = overrides?.findLegal ?? jest.fn();
    const findFirstLegal = overrides?.findFirstLegal ?? jest.fn();
    const findFirstConsent = overrides?.findFirstConsent ?? jest.fn();
    const findManyConsents = overrides?.findManyConsents ?? jest.fn().mockResolvedValue([]);
    const createConsent = overrides?.createConsent ?? jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'consent-1', ...data }));
    const findUniqueConsent = overrides?.findUniqueConsent ?? jest.fn();
    const updateConsent = overrides?.updateConsent ?? jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'consent-1', ...data }));
    const auditLog = overrides?.auditLog ?? jest.fn().mockResolvedValue(undefined);

    const prisma = {
      patient: { findUnique: findPatient },
      legalDocument: { findUnique: findLegal, findFirst: findFirstLegal },
      patientDataProcessingConsent: {
        findFirst: findFirstConsent,
        findMany: findManyConsents,
        create: createConsent,
        findUnique: findUniqueConsent,
        update: updateConsent,
      },
    } as never;
    const audit = { log: auditLog } as never;

    return {
      service: new PatientConsentsService(prisma, audit),
      findPatient,
      findLegal,
      findFirstLegal,
      findFirstConsent,
      findManyConsents,
      createConsent,
      findUniqueConsent,
      updateConsent,
      auditLog,
    };
  }

  describe('hasVigentConsentForActivePrivacyPolicy', () => {
    it('false cuando no hay politica publicada', async () => {
      const { service } = buildService({ findFirstLegal: jest.fn().mockResolvedValue(null) });
      await expect(
        service.hasVigentConsentForActivePrivacyPolicy('p-1', 'ATENCION_CLINICA'),
      ).resolves.toBe(false);
    });

    it('true cuando hay consent vigente para la politica publicada', async () => {
      const { service } = buildService({
        findFirstLegal: jest.fn().mockResolvedValue({ id: 'legal-1' }),
        findFirstConsent: jest.fn().mockResolvedValue({ id: 'consent-1' }),
      });
      await expect(
        service.hasVigentConsentForActivePrivacyPolicy('p-1', 'ATENCION_CLINICA'),
      ).resolves.toBe(true);
    });

    it('false cuando hay politica pero no consent', async () => {
      const { service } = buildService({
        findFirstLegal: jest.fn().mockResolvedValue({ id: 'legal-1' }),
        findFirstConsent: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.hasVigentConsentForActivePrivacyPolicy('p-1', 'ATENCION_CLINICA'),
      ).resolves.toBe(false);
    });
  });

  describe('grant', () => {
    const validDto: any = {
      patientId: 'p-1',
      legalDocumentId: 'legal-1',
      purpose: 'ATENCION_CLINICA',
      method: 'PRESENCIAL_TABLET',
      signerName: 'Juan Pérez',
      signerRut: '12345678-9',
      signerRelationship: 'TITULAR',
    };

    it('rechaza si el paciente no existe', async () => {
      const { service } = buildService({ findPatient: jest.fn().mockResolvedValue(null) });
      await expect(service.grant(validDto, baseUser, requestMeta)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza si la politica no esta PUBLISHED', async () => {
      const { service } = buildService({
        findPatient: jest.fn().mockResolvedValue({ id: 'p-1', fechaNacimiento: null }),
        findLegal: jest.fn().mockResolvedValue({ id: 'legal-1', type: 'PRIVACY', status: 'DRAFT', version: '0.1' }),
      });
      await expect(service.grant(validDto, baseUser, requestMeta)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si la politica no es de tipo PRIVACY', async () => {
      const { service } = buildService({
        findPatient: jest.fn().mockResolvedValue({ id: 'p-1', fechaNacimiento: null }),
        findLegal: jest.fn().mockResolvedValue({ id: 'legal-1', type: 'TERMS', status: 'PUBLISHED', version: '1.0' }),
      });
      await expect(service.grant(validDto, baseUser, requestMeta)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Art 16 quater: rechaza menor de 16 con signerRelationship=TITULAR', async () => {
      const fechaNacimientoMinor = new Date();
      fechaNacimientoMinor.setFullYear(fechaNacimientoMinor.getFullYear() - 10); // 10 anios
      const { service } = buildService({
        findPatient: jest.fn().mockResolvedValue({ id: 'p-1', fechaNacimiento: fechaNacimientoMinor }),
        findLegal: jest.fn().mockResolvedValue({ id: 'legal-1', type: 'PRIVACY', status: 'PUBLISHED', version: '1.0' }),
      });
      await expect(service.grant(validDto, baseUser, requestMeta)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Art 16 quater: acepta menor con signerRelationship=PADRE', async () => {
      const fechaNacimientoMinor = new Date();
      fechaNacimientoMinor.setFullYear(fechaNacimientoMinor.getFullYear() - 10);
      const { service, auditLog, createConsent } = buildService({
        findPatient: jest.fn().mockResolvedValue({ id: 'p-1', fechaNacimiento: fechaNacimientoMinor }),
        findLegal: jest.fn().mockResolvedValue({ id: 'legal-1', type: 'PRIVACY', status: 'PUBLISHED', version: '1.0' }),
      });
      await service.grant({ ...validDto, signerRelationship: 'PADRE' }, baseUser, requestMeta);
      expect(createConsent).toHaveBeenCalled();
      expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
        entityType: 'PatientDataProcessingConsent',
        action: 'CREATE',
      }));
    });

    it('captura adulto OK y persiste evidenceHash', async () => {
      const fechaNacimientoAdulto = new Date();
      fechaNacimientoAdulto.setFullYear(fechaNacimientoAdulto.getFullYear() - 30);
      const { service, createConsent } = buildService({
        findPatient: jest.fn().mockResolvedValue({ id: 'p-1', fechaNacimiento: fechaNacimientoAdulto }),
        findLegal: jest.fn().mockResolvedValue({ id: 'legal-1', type: 'PRIVACY', status: 'PUBLISHED', version: '1.0' }),
      });
      await service.grant(validDto, baseUser, requestMeta);
      const callArg = createConsent.mock.calls[0][0];
      expect(callArg.data.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
      expect(callArg.data.capturedByUserId).toBe('user-1');
      // Ley 21.719 Art 14 quinquies: capturedIp puede llegar cifrado
      // (`enc:v1:...`) si ENCRYPTION_KEY esta configurado, o en plano si no.
      expect(callArg.data.capturedIp === '127.0.0.1' || callArg.data.capturedIp?.startsWith('enc:v1:')).toBe(true);
    });

    it('WEB_TITULAR captura no asocia capturedByUserId al admin', async () => {
      const fechaNacimientoAdulto = new Date();
      fechaNacimientoAdulto.setFullYear(fechaNacimientoAdulto.getFullYear() - 30);
      const { service, createConsent } = buildService({
        findPatient: jest.fn().mockResolvedValue({ id: 'p-1', fechaNacimiento: fechaNacimientoAdulto }),
        findLegal: jest.fn().mockResolvedValue({ id: 'legal-1', type: 'PRIVACY', status: 'PUBLISHED', version: '1.0' }),
      });
      await service.grant({ ...validDto, method: 'WEB_TITULAR' }, baseUser, requestMeta);
      const callArg = createConsent.mock.calls[0][0];
      expect(callArg.data.capturedByUserId).toBeNull();
    });
  });

  describe('revoke', () => {
    it('rechaza si no existe', async () => {
      const { service } = buildService({ findUniqueConsent: jest.fn().mockResolvedValue(null) });
      await expect(service.revoke('c-1', 'motivo', baseUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza si ya esta revocado', async () => {
      const { service } = buildService({
        findUniqueConsent: jest.fn().mockResolvedValue({ id: 'c-1', revokedAt: new Date(), patientId: 'p-1', purpose: 'X' }),
      });
      await expect(service.revoke('c-1', 'motivo', baseUser)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('revoca correctamente con channel y razon', async () => {
      const { service, updateConsent, auditLog } = buildService({
        findUniqueConsent: jest.fn().mockResolvedValue({ id: 'c-1', revokedAt: null, patientId: 'p-1', purpose: 'X' }),
      });
      await service.revoke('c-1', 'motivo declarado por titular', baseUser, 'WEB_TITULAR');
      expect(updateConsent).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          granted: false,
          revokedReason: expect.stringContaining('motivo'),
          revokedChannel: 'WEB_TITULAR',
        }),
      }));
      expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'PATIENT_DATA_CONSENT_REVOKED',
      }));
    });
  });
});
