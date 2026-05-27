/**
 * Cross-patient clinical isolation tests (A4).
 *
 * Scenario: Medico A owns patientA. Medico B tries to read/write
 * clinical data scoped to patientA. Every attempt must return 403 or 404.
 *
 * Modules covered:
 *   patients       — GET /api/patients/:id
 *   encounters     — POST /api/encounters/patient/:id, GET /api/encounters/:id
 *   alerts         — GET /api/alerts/patient/:id, POST /api/alerts
 *   consents       — GET /api/consents/patient/:id, POST /api/consents
 *   patient-consents — GET /api/patient-consents/patient/:id
 *   problems       — POST /api/patients/:id/problems
 *   tasks          — POST /api/patients/:id/tasks
 *   attachments    — GET /api/patients/:id/export/bundle (requires attachment access)
 */

import {
  bootstrapApp,
  teardownApp,
  req,
  extractCookies,
  cookieHeader,
  TEST_LEGAL_ACCEPTANCE,
} from './helpers/e2e-setup';

describe('Clinical Cross-Patient Isolation (A4)', () => {
  let adminCookies: string[] = [];
  let medicoCookies: string[] = [];
  let medicoBCookies: string[] = [];
  let patientAId = '';
  let encounterAId = '';
  let alertAId = '';
  let consentAId = '';

  // ── Bootstrap: two medicos, one patient owned by medico A ──────────

  beforeAll(async () => {
    await bootstrapApp();

    // Register admin (first user gets admin role automatically)
    const adminRes = await req()
      .post('/api/auth/register')
      .send({
        email: 'admin-isolation@test.com',
        password: 'Admin123!',
        nombre: 'Admin Isolation',
        role: 'ADMIN',
        ...TEST_LEGAL_ACCEPTANCE,
      })
      .expect(201);
    adminCookies = extractCookies(adminRes);

    // Invite and register Medico A
    const invA = await req()
      .post('/api/users/invitations')
      .set('Cookie', cookieHeader(adminCookies))
      .send({ email: 'medico-a@test.com', role: 'MEDICO' })
      .expect(201);

    const medicoARes = await req()
      .post('/api/auth/register')
      .send({
        email: 'medico-a@test.com',
        password: 'MedicoA1!',
        nombre: 'Dr. A',
        role: 'MEDICO',
        invitationToken: invA.body.token,
        ...TEST_LEGAL_ACCEPTANCE,
      })
      .expect(201);
    medicoCookies = extractCookies(medicoARes);

    // Invite and register Medico B
    const invB = await req()
      .post('/api/users/invitations')
      .set('Cookie', cookieHeader(adminCookies))
      .send({ email: 'medico-b@test.com', role: 'MEDICO' })
      .expect(201);

    const medicoBRes = await req()
      .post('/api/auth/register')
      .send({
        email: 'medico-b@test.com',
        password: 'MedicoB1!',
        nombre: 'Dr. B',
        role: 'MEDICO',
        invitationToken: invB.body.token,
        ...TEST_LEGAL_ACCEPTANCE,
      })
      .expect(201);
    medicoBCookies = extractCookies(medicoBRes);

    // Medico A creates patient
    const patientRes = await req()
      .post('/api/patients')
      .set('Cookie', cookieHeader(medicoCookies))
      .send({
        nombre: 'Paciente A',
        fechaNacimiento: '1985-03-15',
        edad: 40,
        sexo: 'MASCULINO',
        prevision: 'FONASA',
      })
      .expect(201);
    patientAId = patientRes.body.id;

    // Medico A creates encounter
    const encounterRes = await req()
      .post(`/api/encounters/patient/${patientAId}`)
      .set('Cookie', cookieHeader(medicoCookies))
      .send({})
      .expect(201);
    encounterAId = encounterRes.body.id;

    // Medico A creates an alert
    const alertRes = await req()
      .post('/api/alerts')
      .set('Cookie', cookieHeader(medicoCookies))
      .send({
        patientId: patientAId,
        type: 'GENERAL',
        priority: 'LOW',
        title: 'Alerta test A',
        body: 'Cuerpo de la alerta',
      })
      .expect(201);
    alertAId = alertRes.body.id;

    // Medico A creates a clinical consent
    const consentRes = await req()
      .post('/api/consents')
      .set('Cookie', cookieHeader(medicoCookies))
      .send({
        patientId: patientAId,
        type: 'INFORMADO',
        title: 'Consentimiento A',
        body: 'Cuerpo del consentimiento',
        signedAt: new Date().toISOString(),
      })
      .expect(201);
    consentAId = consentRes.body.id;
  }, 60_000);

  afterAll(teardownApp);

  // ── Patient isolation ──────────────────────────────────────────────

  describe('Patient access', () => {
    it('Medico B cannot read patient A details', async () => {
      await req()
        .get(`/api/patients/${patientAId}`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });

    it('Medico B cannot export patient A bundle', async () => {
      await req()
        .get(`/api/patients/${patientAId}/export/bundle`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });
  });

  // ── Encounter isolation ────────────────────────────────────────────

  describe('Encounter access', () => {
    it('Medico B cannot create encounter for patient A', async () => {
      await req()
        .post(`/api/encounters/patient/${patientAId}`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .send({})
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });

    it('Medico B cannot read encounter A', async () => {
      await req()
        .get(`/api/encounters/${encounterAId}`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });

    it('Medico B cannot list encounters for patient A', async () => {
      await req()
        .get(`/api/encounters/patient/${patientAId}`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });

    it('Medico B cannot save a section on encounter A', async () => {
      await req()
        .put(`/api/encounters/${encounterAId}/sections/MOTIVO_CONSULTA`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .send({ data: { text: 'intrusion' } })
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });
  });

  // ── Alert isolation ────────────────────────────────────────────────

  describe('Alert access', () => {
    it('Medico B cannot list alerts for patient A', async () => {
      await req()
        .get(`/api/alerts/patient/${patientAId}`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });

    it('Medico B cannot create alert for patient A', async () => {
      await req()
        .post('/api/alerts')
        .set('Cookie', cookieHeader(medicoBCookies))
        .send({
          patientId: patientAId,
          type: 'GENERAL',
          priority: 'LOW',
          title: 'Alerta intrusion',
          body: 'Intrusion',
        })
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });

    it('Medico B cannot acknowledge alert A', async () => {
      await req()
        .post(`/api/alerts/${alertAId}/acknowledge`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });
  });

  // ── Clinical consent isolation ─────────────────────────────────────

  describe('Clinical consent access', () => {
    it('Medico B cannot list consents for patient A', async () => {
      await req()
        .get(`/api/consents/patient/${patientAId}`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });

    it('Medico B cannot create consent for patient A', async () => {
      await req()
        .post('/api/consents')
        .set('Cookie', cookieHeader(medicoBCookies))
        .send({
          patientId: patientAId,
          type: 'INFORMADO',
          title: 'Intrusion consent',
          body: 'Cuerpo',
          signedAt: new Date().toISOString(),
        })
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });

    it('Medico B cannot revoke consent A', async () => {
      await req()
        .post(`/api/consents/${consentAId}/revoke`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .send({ revokeReason: 'Intento de revocación no autorizada' })
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });
  });

  // ── Data-processing consent isolation ─────────────────────────────

  describe('Patient-consents (data processing) access', () => {
    it('Medico B cannot list data-processing consents for patient A', async () => {
      await req()
        .get(`/api/patient-consents/patient/${patientAId}`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });
  });

  // ── Problems isolation ─────────────────────────────────────────────

  describe('Patient problems access', () => {
    it('Medico B cannot create a problem for patient A', async () => {
      await req()
        .post(`/api/patients/${patientAId}/problems`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .send({
          title: 'Problema intruso',
          type: 'ACTIVO',
        })
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });
  });

  // ── Tasks isolation ────────────────────────────────────────────────

  describe('Patient tasks access', () => {
    it('Medico B cannot create a task for patient A', async () => {
      await req()
        .post(`/api/patients/${patientAId}/tasks`)
        .set('Cookie', cookieHeader(medicoBCookies))
        .send({
          title: 'Tarea intrusa',
          dueDate: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });
  });

  // ── Medico A retains full access ───────────────────────────────────

  describe('Medico A retains access to own data', () => {
    it('Medico A can still read patient A', async () => {
      await req()
        .get(`/api/patients/${patientAId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);
    });

    it('Medico A can still read encounter A', async () => {
      await req()
        .get(`/api/encounters/${encounterAId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);
    });

    it('Medico A can still list alerts for patient A', async () => {
      const res = await req()
        .get(`/api/alerts/patient/${patientAId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);
      const ids = [...res.body.active, ...res.body.acknowledged].map((a: any) => a.id);
      expect(ids).toContain(alertAId);
    });

    it('Medico A can still list consents for patient A', async () => {
      const res = await req()
        .get(`/api/consents/patient/${patientAId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);
      const ids = res.body.map((c: any) => c.id);
      expect(ids).toContain(consentAId);
    });
  });
});
