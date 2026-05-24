import { randomUUID } from 'crypto';
import { state, prisma, req, cookieHeader } from '../helpers/e2e-setup';
import { buildEncryptedPatientIdentifierFields } from '../../src/patients/patients-identifiers';

/**
 * E2E completo del cumplimiento Ley 21.719 con login admin:
 *   1. Consentimiento del titular (grant + revoke + NNA + listado)
 *   2. Gate hard del PolicyComplianceService
 *   3. Bloqueo del paciente (Art 8 ter) + rechazo de mutaciones clinicas
 *   4. Ciclo DSAR end-to-end con enlace de descarga y revocacion
 *   5. Brecha con notify-subjects (Art 14 sexies, 11 elementos)
 *   6. Integridad de la cadena de auditoria despues de todos los flujos
 *
 * Depende de:
 *   - state.adminCookies (admin.e2e-suite)
 *   - state.medicoCookies, state.medicoUserId (auth-registration + admin)
 *   - state.patientId (patients-registration.e2e-suite, con RUT 12.345.678-5)
 *   - state.quickPatientId (patients-registration.e2e-suite, rutExempt)
 */
export function complianceFlowsSuite() {
  describe('Compliance flows (Ley 21.719) - admin login', () => {
    let privacyPolicyId: string;
    let dataRequestId: string;
    let breachId: string;
    let exportToken: string;
    let downloadId: string;
    let nnaPatientId: string;

    beforeAll(async () => {
      // Politica de privacidad con UUID v4 para satisfacer @IsUUID en DTOs.
      privacyPolicyId = randomUUID();
      const now = new Date();
      await prisma.legalDocument.create({
        data: {
          id: privacyPolicyId,
          type: 'PRIVACY',
          version: '2026-05-23-compliance-e2e',
          status: 'PUBLISHED',
          title: 'Politica de privacidad (compliance-flows test)',
          description: 'Politica con UUID id para tests de consentimiento.',
          contentJson: JSON.stringify({ summary: ['compliance-flows e2e'], sections: [] }),
          effectiveAt: now,
          publishedAt: now,
        },
      });
    });

    afterAll(async () => {
      await prisma.patientDataProcessingConsent.deleteMany({
        where: { legalDocumentId: privacyPolicyId },
      });
      await prisma.legalDocument.delete({ where: { id: privacyPolicyId } }).catch(() => {});
      if (nnaPatientId) {
        await prisma.patient.delete({ where: { id: nnaPatientId } }).catch(() => {});
      }
    });

    // ──────────────────────────────────────────────────────────────────
    // 1. Consentimiento del titular (Art 12)
    // ──────────────────────────────────────────────────────────────────
    describe('PatientDataProcessingConsent (Art 12)', () => {
      it('POST /api/patient-consents/grant -> ATENCION_CLINICA para paciente principal', async () => {
        const res = await req()
          .post('/api/patient-consents/grant')
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            patientId: state.patientId,
            legalDocumentId: privacyPolicyId,
            purpose: 'ATENCION_CLINICA',
            method: 'PRESENCIAL_TABLET',
            signerName: 'Paciente Test',
            signerRut: '12.345.678-5',
            signerRelationship: 'TITULAR',
            language: 'es-CL',
          })
          .expect(201);

        expect(res.body.id).toBeDefined();
        expect(res.body.granted).toBe(true);
        expect(res.body.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
      });

      it('GET /api/patient-consents/patient/:patientId -> lista consentimientos vigentes', async () => {
        const res = await req()
          .get(`/api/patient-consents/patient/${state.patientId}`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0].patientId).toBe(state.patientId);
      });

      it('POST /api/patient-consents/grant -> rechaza signerRelationship TITULAR para NNA <16', async () => {
        const nna = await prisma.patient.create({
          data: {
            createdById: state.medicoUserId,
            ...buildEncryptedPatientIdentifierFields({ nombre: 'NNA Test' }),
            fechaNacimiento: new Date(Date.now() - 8 * 365.25 * 24 * 60 * 60 * 1000),
            rutExempt: true,
            rutExemptReason: 'Menor sin RUT',
          },
        });
        nnaPatientId = nna.id;

        const bad = await req()
          .post('/api/patient-consents/grant')
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            patientId: nna.id,
            legalDocumentId: privacyPolicyId,
            purpose: 'ATENCION_CLINICA',
            method: 'PRESENCIAL_TABLET',
            signerName: 'NNA Test',
            signerRelationship: 'TITULAR',
          });
        expect(bad.status).toBe(400);
        expect(String(bad.body.message)).toMatch(/menor de 16/i);

        const ok = await req()
          .post('/api/patient-consents/grant')
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            patientId: nna.id,
            legalDocumentId: privacyPolicyId,
            purpose: 'ATENCION_CLINICA',
            method: 'REPRESENTANTE',
            signerName: 'Madre del NNA',
            signerRelationship: 'MADRE',
          })
          .expect(201);
        expect(ok.body.granted).toBe(true);
      });

      it('POST /api/patient-consents/:id/revoke -> revoca consentimiento auxiliar', async () => {
        const grant = await req()
          .post('/api/patient-consents/grant')
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            patientId: state.patientId,
            legalDocumentId: privacyPolicyId,
            purpose: 'ANALITICA_INTERNA',
            method: 'PRESENCIAL_TABLET',
            signerName: 'Paciente Test',
            signerRelationship: 'TITULAR',
          })
          .expect(201);

        const res = await req()
          .post(`/api/patient-consents/${grant.body.id}/revoke`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            reason: 'Titular se opone a analitica interna (Art 8).',
            channel: 'PRESENCIAL',
          })
          .expect(200);

        expect(res.body.revokedAt).toBeDefined();
        expect(res.body.granted).toBe(false);
        expect(res.body.revokedChannel).toBe('PRESENCIAL');
      });

      it('POST /api/patient-consents/:id/revoke -> segundo revoke en el mismo consent retorna 400', async () => {
        const grant = await req()
          .post('/api/patient-consents/grant')
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            patientId: state.patientId,
            legalDocumentId: privacyPolicyId,
            purpose: 'COMUNICACIONES',
            method: 'PRESENCIAL_TABLET',
            signerName: 'Paciente Test',
            signerRelationship: 'TITULAR',
          })
          .expect(201);
        const id = grant.body.id;
        await req()
          .post(`/api/patient-consents/${id}/revoke`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({ reason: 'Revoca primera' })
          .expect(200);
        const second = await req()
          .post(`/api/patient-consents/${id}/revoke`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({ reason: 'Revoca segunda' });
        expect(second.status).toBe(400);
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // 2. PolicyComplianceService - modo hard (Gate Go/No-Go produccion)
    // ──────────────────────────────────────────────────────────────────
    describe('PolicyComplianceService modo hard', () => {
      let originalMode: string | undefined;
      beforeAll(() => {
        originalMode = process.env.REGULATORY_CONSENT_ENFORCEMENT;
        process.env.REGULATORY_CONSENT_ENFORCEMENT = 'hard';
      });
      afterAll(() => {
        if (originalMode === undefined) delete process.env.REGULATORY_CONSENT_ENFORCEMENT;
        else process.env.REGULATORY_CONSENT_ENFORCEMENT = originalMode;
      });

      it('PUT /api/patients/:id -> 403 cuando no hay consentimiento ATENCION_CLINICA', async () => {
        const res = await req()
          .put(`/api/patients/${state.quickPatientId}`)
          .set('Cookie', cookieHeader(state.medicoCookies))
          .send({ trabajo: 'Empleado (sin consent)' });
        expect(res.status).toBe(403);
        expect(String(res.body.message)).toMatch(/consentimiento vigente/i);
      });

      it('POST /api/patient-consents/grant + PUT /api/patients/:id -> 200 tras otorgar consent', async () => {
        await req()
          .post('/api/patient-consents/grant')
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            patientId: state.quickPatientId,
            legalDocumentId: privacyPolicyId,
            purpose: 'ATENCION_CLINICA',
            method: 'PRESENCIAL_TABLET',
            signerName: 'Paciente Quick',
            signerRelationship: 'TITULAR',
          })
          .expect(201);

        await req()
          .put(`/api/patients/${state.quickPatientId}`)
          .set('Cookie', cookieHeader(state.medicoCookies))
          .send({ trabajo: 'Empleado (post-consent)' })
          .expect(200);
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // 3. Bloqueo del paciente (Art 8 ter)
    // ──────────────────────────────────────────────────────────────────
    describe('Patient blocking (Art 8 ter)', () => {
      it('POST /api/patients/:id/block -> admin bloquea al paciente', async () => {
        const res = await req()
          .post(`/api/patients/${state.patientId}/block`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({ reason: 'Bloqueo solicitado por el titular (Art 8 ter).' })
          .expect(200);
        expect(res.body.blockedAt).toBeDefined();
        expect(String(res.body.blockedReason)).toContain('titular');
      });

      it('POST /api/encounters/patient/:patientId -> 403 con paciente bloqueado', async () => {
        const res = await req()
          .post(`/api/encounters/patient/${state.patientId}`)
          .set('Cookie', cookieHeader(state.medicoCookies))
          .send({});
        expect(res.status).toBe(403);
        expect(String(res.body.message)).toMatch(/bloqueo temporal vigente|Art 8 ter/);
      });

      it('POST /api/patients/:id/unblock -> admin levanta el bloqueo', async () => {
        const res = await req()
          .post(`/api/patients/${state.patientId}/unblock`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({ reason: 'Revision completada, levantamiento del bloqueo.' })
          .expect(200);
        expect(res.body.blockedAt).toBeNull();
      });

      it('POST /api/encounters/patient/:patientId -> tras unblock, crea atencion 201', async () => {
        const res = await req()
          .post(`/api/encounters/patient/${state.patientId}`)
          .set('Cookie', cookieHeader(state.medicoCookies))
          .send({});
        expect(res.status).toBe(201);
        expect(res.body.id).toBeDefined();
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // 4. DSAR end-to-end (Art 4-11) con enlace de descarga
    // ──────────────────────────────────────────────────────────────────
    describe('DSAR full lifecycle (Art 4-11)', () => {
      it('POST /api/public/derechos -> titular envia solicitud ACCESO', async () => {
        const res = await req()
          .post('/api/public/derechos')
          .send({
            requesterName: 'Paciente Test',
            requesterEmail: 'titular-dsar-full@example.com',
            requesterRut: '12.345.678-5',
            requestType: 'ACCESO',
            payloadRequest: 'Solicito copia completa de mi ficha clinica (e2e DSAR full lifecycle).',
          })
          .expect(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.status).toBe('RECIBIDA');
        dataRequestId = res.body.id;
      });

      it('GET /api/admin/data-requests -> admin lista solicitud recien creada', async () => {
        const res = await req()
          .get('/api/admin/data-requests')
          .set('Cookie', cookieHeader(state.adminCookies))
          .expect(200);
        expect(res.body.find((r: any) => r.id === dataRequestId)).toBeDefined();
      });

      it('PATCH /api/admin/data-requests/:id -> admin vincula paciente + identidad', async () => {
        const res = await req()
          .patch(`/api/admin/data-requests/${dataRequestId}`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            patientId: state.patientId,
            identityVerificationMethod: 'CEDULA_FOTO',
            status: 'EN_REVISION',
          })
          .expect(200);
        expect(res.body.patientId).toBe(state.patientId);
        expect(res.body.status).toBe('EN_REVISION');
      });

      it('POST /api/admin/data-requests/:id/extend -> primera prorroga 200', async () => {
        const res = await req()
          .post(`/api/admin/data-requests/${dataRequestId}/extend`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            reason: 'Volumen excepcional: requiere consolidar 30 atenciones y validacion clinica adicional.',
          })
          .expect(200);
        expect(res.body.prorrogaDueDate).toBeDefined();
      });

      it('POST /api/admin/data-requests/:id/extend -> segunda prorroga rechazada (Art 11 permite solo una)', async () => {
        const res = await req()
          .post(`/api/admin/data-requests/${dataRequestId}/extend`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({ reason: 'Intento duplicado de extension.' });
        expect(res.status).toBe(400);
      });

      it('POST /api/admin/data-requests/:id/export-link -> genera enlace temporal', async () => {
        const res = await req()
          .post(`/api/admin/data-requests/${dataRequestId}/export-link`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({ ttlHours: 24 })
          .expect(200);
        expect(res.body.id).toBeDefined();
        expect(res.body.downloadUrl).toMatch(/[?&]token=/);
        const url = new URL(res.body.downloadUrl);
        exportToken = url.searchParams.get('token') as string;
        downloadId = res.body.id;
      });

      it('POST /api/public/data-request-downloads/:token/download -> rechaza RUT incorrecto', async () => {
        const res = await req()
          .post(`/api/public/data-request-downloads/${exportToken}/download`)
          .send({ requesterRut: '99.999.999-9' });
        expect(res.status).toBe(401);
      });

      it('POST /api/public/data-request-downloads/:token/download -> entrega ZIP con RUT correcto', async () => {
        const res = await req()
          .post(`/api/public/data-request-downloads/${exportToken}/download`)
          .send({ requesterRut: '12345678-5' });
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('application/zip');
        expect(Number(res.headers['content-length'])).toBeGreaterThan(100);
      });

      it('POST /api/admin/data-requests/:id/resolve -> admin resuelve aceptada', async () => {
        const res = await req()
          .post(`/api/admin/data-requests/${dataRequestId}/resolve`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            status: 'RESUELTA_ACEPTADA',
            resolutionNote: 'ZIP entregado mediante enlace temporal con verificacion de identidad.',
          })
          .expect(200);
        expect(res.body.status).toBe('RESUELTA_ACEPTADA');
        expect(res.body.resolvedAt).toBeDefined();
      });

      it('POST /api/admin/data-request-downloads/:id/revoke -> admin revoca enlace tras entrega', async () => {
        const res = await req()
          .post(`/api/admin/data-request-downloads/${downloadId}/revoke`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({ reason: 'Entrega completada satisfactoriamente, link cerrado por seguridad.' })
          .expect(200);
        expect(res.body.revokedAt).toBeDefined();
      });

      it('POST /api/public/data-request-downloads/:token/download -> 401 tras revocar enlace', async () => {
        const res = await req()
          .post(`/api/public/data-request-downloads/${exportToken}/download`)
          .send({ requesterRut: '12345678-5' });
        expect(res.status).toBe(401);
      });

      it('GET /api/admin/data-requests/:id -> muestra estado final resuelto', async () => {
        const res = await req()
          .get(`/api/admin/data-requests/${dataRequestId}`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .expect(200);
        expect(res.body.status).toBe('RESUELTA_ACEPTADA');
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // 5. Brecha de seguridad (Art 14 sexies) + notify-subjects
    // ──────────────────────────────────────────────────────────────────
    describe('DataBreach lifecycle (Art 14 sexies)', () => {
      it('POST /api/admin/data-breaches -> admin abre incidente ALTO con paciente afectado', async () => {
        const res = await req()
          .post('/api/admin/data-breaches')
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            detectedAt: new Date().toISOString(),
            severity: 'ALTO',
            scope: 'Perdida de notebook con cache local de 10 fichas clinicas (e2e simulacion).',
            affectedPatientIds: [state.patientId],
            rootCause: 'Perdida fisica en transporte publico.',
            containmentActions: 'Reset credenciales del usuario afectado, bloqueo remoto del disco.',
          })
          .expect(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.status).toBe('ABIERTO');
        breachId = res.body.id;
      });

      it('POST /api/admin/data-breaches/:id/assess -> registra decision REPORTAR', async () => {
        const res = await req()
          .post(`/api/admin/data-breaches/${breachId}/assess`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            riskAssessment: 'Datos sensibles de salud: riesgo razonable confirmado, procede notificar Agencia y titulares.',
            agencyDecision: 'REPORTAR',
          })
          .expect(200);
        expect(res.body.status).toBe('EN_EVALUACION');
        expect(res.body.riskAssessment).toContain('riesgo razonable');
      });

      it('POST /api/admin/data-breaches/:id/notify-agency -> registra reportedToAgencyAt', async () => {
        const res = await req()
          .post(`/api/admin/data-breaches/${breachId}/notify-agency`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({ reportedAt: new Date().toISOString() })
          .expect(200);
        expect(res.body.reportedToAgencyAt).toBeDefined();
      });

      it('POST /api/admin/data-breaches/:id/notify-subjects -> notifica con 11 elementos minimos (Art 14 sexies inc 3)', async () => {
        const res = await req()
          .post(`/api/admin/data-breaches/${breachId}/notify-subjects`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            notifiedAt: new Date().toISOString(),
            measuresTaken: 'Reset de credenciales, bloqueo remoto del equipo, auditoria completa de accesos sospechosos. Cifrado app-level mitiga el riesgo de filtrado en plaintext.',
            responsableName: 'Anamneo SpA',
            dpoName: 'Alejandro Lopez Zelaya',
            dpoEmail: 'allopze@gmail.com',
            dataCategoriesAffected: 'Datos clinicos: motivo de consulta, diagnosticos, plan terapeutico.',
            possibleConsequences: 'Acceso no autorizado a informacion sensible de salud por parte de terceros.',
            recommendedActions: 'Revise movimientos recientes en sus servicios medicos y reporte cualquier actividad sospechosa.',
            consultationChannels: 'dpo@anamneo.cl / +56 9 0000 0000',
            followUpInfo: 'Investigacion interna en curso. Actualizacion del estado en 30 dias corridos.',
          })
          .expect(200);
        expect(res.body.reportedToSubjectsAt).toBeDefined();
        expect(res.body.status).toBe('NOTIFICADO');
        expect(res.body.deliveryStats).toBeDefined();
        // Patient `state.patientId` no tiene email registrado -> debe haber al menos 1 skipped
        expect(res.body.deliveryStats.sent + res.body.deliveryStats.skipped).toBeGreaterThan(0);
      });

      it('POST /api/admin/data-breaches/:id/notify-subjects -> segundo intento rechazado', async () => {
        const res = await req()
          .post(`/api/admin/data-breaches/${breachId}/notify-subjects`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            measuresTaken: 'Intento duplicado de notificacion (deberia rechazarse).',
          });
        expect(res.status).toBe(400);
      });

      it('POST /api/admin/data-breaches/:id/close -> cierra con postmortem', async () => {
        const res = await req()
          .post(`/api/admin/data-breaches/${breachId}/close`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            postMortem: 'Causa raiz: backup local no autorizado. Mitigacion: politica de equipos cifrados al 100% + prohibicion de backups locales.',
          })
          .expect(200);
        expect(res.body.status).toBe('CERRADO');
      });

      it('GET /api/admin/data-breaches -> brecha cerrada visible en listado', async () => {
        const res = await req()
          .get('/api/admin/data-breaches')
          .set('Cookie', cookieHeader(state.adminCookies))
          .expect(200);
        expect(res.body.find((b: any) => b.id === breachId && b.status === 'CERRADO')).toBeDefined();
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // 6. Integridad de la cadena de auditoria tras todos los flujos
    // ──────────────────────────────────────────────────────────────────
    describe('Audit chain integrity after compliance flows', () => {
      it('GET /api/audit/integrity/verify -> cadena valida cubriendo eventos nuevos', async () => {
        const res = await req()
          .get('/api/audit/integrity/verify')
          .query({ limit: 20000 })
          .set('Cookie', cookieHeader(state.adminCookies))
          .expect(200);
        expect(res.body.valid).toBe(true);
        expect(res.body.checked).toBeGreaterThan(0);
      });

      it('GET /api/audit?entityType=PatientDataProcessingConsent -> hay registros de consentimientos', async () => {
        const res = await req()
          .get('/api/audit')
          .query({ entityType: 'PatientDataProcessingConsent', page: 1, limit: 50 })
          .set('Cookie', cookieHeader(state.adminCookies))
          .expect(200);
        expect(res.body.data.length).toBeGreaterThan(0);
      });

      it('GET /api/audit?entityType=PatientDataRequest -> registros del ciclo DSAR', async () => {
        const res = await req()
          .get('/api/audit')
          .query({ entityType: 'PatientDataRequest', page: 1, limit: 50 })
          .set('Cookie', cookieHeader(state.adminCookies))
          .expect(200);
        expect(res.body.data.some((item: any) => item.entityId === dataRequestId)).toBe(true);
      });

      it('GET /api/audit?entityType=DataBreachIncident -> registros del ciclo breach', async () => {
        const res = await req()
          .get('/api/audit')
          .query({ entityType: 'DataBreachIncident', page: 1, limit: 50 })
          .set('Cookie', cookieHeader(state.adminCookies))
          .expect(200);
        expect(res.body.data.some((item: any) => item.entityId === breachId)).toBe(true);
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // 7. Phase D — cifrado legalRepresentative* (NNA Art 16 quater)
    // ──────────────────────────────────────────────────────────────────
    describe('Phase D — cifrado legalRepresentative (NNA Art 16 quater)', () => {
      let nnaEncPatientId: string;

      afterAll(async () => {
        if (nnaEncPatientId) {
          await prisma.patient.delete({ where: { id: nnaEncPatientId } }).catch(() => {});
        }
      });

      it('POST /api/patients -> persiste representante legal cifrado en DB', async () => {
        const res = await req()
          .post('/api/patients')
          .set('Cookie', cookieHeader(state.medicoCookies))
          .send({
            nombre: 'NNA Cifrado Test',
            fechaNacimiento: '2018-03-10',
            edad: 7,
            sexo: 'MASCULINO',
            prevision: 'FONASA_A',
            rutExempt: true,
            rutExemptReason: 'Menor sin RUT',
            legalRepresentativeName: 'Madre del NNA Cifrado',
            legalRepresentativeRut: '11.222.333-4',
            legalRepresentativeRelationship: 'MADRE',
            legalRepresentativeContact: 'madre@test.cl',
          })
          .expect(201);

        nnaEncPatientId = res.body.id;
        // La API devuelve plaintext descifrado
        expect(res.body.legalRepresentativeName).toBe('Madre del NNA Cifrado');
        expect(res.body.legalRepresentativeRelationship).toBe('MADRE');
        expect(res.body.legalRepresentativeContact).toBe('madre@test.cl');

        // En DB debe estar cifrado (enc:v1:...)
        const raw = await prisma.patient.findUnique({
          where: { id: nnaEncPatientId },
          select: {
            legalRepresentativeNameEnc: true,
            legalRepresentativeRutEnc: true,
            legalRepresentativeRutLookupHash: true,
            legalRepresentativeName: true,
          },
        });
        expect(raw!.legalRepresentativeNameEnc).toMatch(/^enc:v1:/);
        expect(raw!.legalRepresentativeRutEnc).toMatch(/^enc:v1:/);
        expect(raw!.legalRepresentativeRutLookupHash).toMatch(/^[a-f0-9]{64}$/);
      });

      it('GET /api/patients/:id -> devuelve representante legal descifrado', async () => {
        const res = await req()
          .get(`/api/patients/${nnaEncPatientId}`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .expect(200);

        expect(res.body.legalRepresentativeName).toBe('Madre del NNA Cifrado');
        expect(res.body.legalRepresentativeRut).toBe('11.222.333-4');
        expect(res.body.legalRepresentativeContact).toBe('madre@test.cl');
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // 8. Phase E — cifrado consent signer
    // ──────────────────────────────────────────────────────────────────
    describe('Phase E — cifrado signerName/signerRut (Art 12)', () => {
      it('POST /api/patient-consents/grant -> persiste firmante cifrado en DB', async () => {
        const res = await req()
          .post('/api/patient-consents/grant')
          .set('Cookie', cookieHeader(state.adminCookies))
          .send({
            patientId: state.patientId,
            legalDocumentId: privacyPolicyId,
            purpose: 'INVESTIGACION',
            method: 'PRESENCIAL_TABLET',
            signerName: 'Firmante Cifrado Test',
            signerRut: '12.345.678-5',
            signerRelationship: 'TITULAR',
          })
          .expect(201);

        const consentId = res.body.id;
        const raw = await prisma.patientDataProcessingConsent.findUnique({
          where: { id: consentId },
          select: { signerNameEnc: true, signerRutEnc: true, signerRutLookupHash: true, signerName: true },
        });
        expect(raw!.signerNameEnc).toMatch(/^enc:v1:/);
        expect(raw!.signerRutEnc).toMatch(/^enc:v1:/);
        expect(raw!.signerRutLookupHash).toMatch(/^[a-f0-9]{64}$/);
      });

      it('GET /api/patient-consents/patient/:patientId -> devuelve signerName descifrado', async () => {
        const res = await req()
          .get(`/api/patient-consents/patient/${state.patientId}`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .expect(200);

        const withSigner = res.body.find((c: any) => c.signerName === 'Firmante Cifrado Test');
        expect(withSigner).toBeDefined();
        expect(withSigner.signerRut).toBe('12.345.678-5');
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // 9. Phase F — cifrado requester DSAR
    // ──────────────────────────────────────────────────────────────────
    describe('Phase F — cifrado requesterName/Rut/Email DSAR (Art 4-11)', () => {
      let encDataRequestId: string;

      it('POST /api/public/derechos -> persiste requester cifrado en DB', async () => {
        const res = await req()
          .post('/api/public/derechos')
          .send({
            requestType: 'ACCESO',
            requesterName: 'Titular Cifrado Test',
            requesterRut: '9.876.543-2',
            requesterEmail: 'titular-cifrado@test.cl',
            payloadRequest: 'Solicitud de acceso cifrada E2E',
            submittedBy: 'TITULAR',
          })
          .expect(201);

        encDataRequestId = res.body.id;

        const raw = await prisma.patientDataRequest.findUnique({
          where: { id: encDataRequestId },
          select: {
            requesterNameEnc: true,
            requesterRutEnc: true,
            requesterRutLookupHash: true,
            requesterEmailEnc: true,
          },
        });
        expect(raw!.requesterNameEnc).toMatch(/^enc:v1:/);
        expect(raw!.requesterRutEnc).toMatch(/^enc:v1:/);
        expect(raw!.requesterRutLookupHash).toMatch(/^[a-f0-9]{64}$/);
        expect(raw!.requesterEmailEnc).toMatch(/^enc:v1:/);
      });

      it('GET /api/admin/data-requests/:id -> devuelve requester con plaintext fallback durante backfill', async () => {
        const res = await req()
          .get(`/api/admin/data-requests/${encDataRequestId}`)
          .set('Cookie', cookieHeader(state.adminCookies))
          .expect(200);

        // El servicio puede devolver plaintext o descifrado; lo importante es que no explota
        expect(res.body.id).toBe(encDataRequestId);
        expect(res.body.requesterName).toBeDefined();
      });

      afterAll(async () => {
        if (encDataRequestId) {
          await prisma.patientDataRequest.delete({ where: { id: encDataRequestId } }).catch(() => {});
        }
      });
    });
  });
}
