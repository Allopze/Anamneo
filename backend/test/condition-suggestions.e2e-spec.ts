import {
  bootstrapApp,
  teardownApp,
  req,
  extractCookies,
  cookieHeader,
  prisma,
} from './helpers/e2e-setup';
import { CONDITION_SUGGESTION_RANKING_VERSION } from '../src/conditions/conditions-suggestion-log';

describe('Condition Suggestions Isolated E2E', () => {
  let adminCookies: string[] = [];
  let medicoCookies: string[] = [];
  let encounterId = '';

  beforeAll(async () => {
    await bootstrapApp();

    const adminRes = await req()
      .post('/api/auth/register')
      .send({
        email: 'admin-suggestions@test.com',
        password: 'Admin123',
        nombre: 'Admin Suggestions',
        role: 'ADMIN',
      })
      .expect(201);

    adminCookies = extractCookies(adminRes);

    const invitationRes = await req()
      .post('/api/users/invitations')
      .set('Cookie', cookieHeader(adminCookies))
      .send({
        email: 'medico-suggestions@test.com',
        role: 'MEDICO',
      })
      .expect(201);

    const medicoRes = await req()
      .post('/api/auth/register')
      .send({
        email: 'medico-suggestions@test.com',
        password: 'Medico123',
        nombre: 'Dr. Suggestions',
        role: 'MEDICO',
        invitationToken: invitationRes.body.token,
      })
      .expect(201);

    medicoCookies = extractCookies(medicoRes);

    await req()
      .post('/api/conditions/local')
      .set('Cookie', cookieHeader(medicoCookies))
      .send({
        name: 'Hipertensión arterial',
        synonyms: ['presión alta', 'hta'],
        tags: ['cardiovascular'],
      })
      .expect(201);

    await req()
      .post('/api/conditions/local')
      .set('Cookie', cookieHeader(medicoCookies))
      .send({
        name: 'Migraña',
        synonyms: ['dolor de cabeza'],
        tags: ['cefalea'],
      })
      .expect(201);

    const patientRes = await req()
      .post('/api/patients')
      .set('Cookie', cookieHeader(medicoCookies))
      .send({
        rut: '12.345.678-5',
        nombre: 'Paciente Suggestions',
        edad: 35,
        sexo: 'MASCULINO',
        prevision: 'FONASA',
        trabajo: 'Ingeniero',
        domicilio: 'Santiago',
      })
      .expect(201);

    const encounterRes = await req()
      .post(`/api/encounters/patient/${patientRes.body.id}`)
      .set('Cookie', cookieHeader(medicoCookies))
      .send({})
      .expect(201);

    encounterId = encounterRes.body.id;
  }, 30_000);

  afterAll(teardownApp);

  it('fetches ranked suggestions for encounter text', async () => {
    const res = await req()
      .post('/api/conditions/suggest')
      .set('Cookie', cookieHeader(medicoCookies))
      .send({ text: 'presión alta persistente', limit: 3 })
      .expect(201);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      confidence: expect.any(Number),
    });
  });

  it('rejects inconsistent AUTO payloads', async () => {
    const suggestionsRes = await req()
      .post('/api/conditions/suggest')
      .set('Cookie', cookieHeader(medicoCookies))
      .send({ text: 'presión alta persistente', limit: 3 })
      .expect(201);

    await req()
      .post(`/api/conditions/encounters/${encounterId}/suggestion`)
      .set('Cookie', cookieHeader(medicoCookies))
      .send({
        inputText: 'presión alta persistente',
        suggestions: suggestionsRes.body,
        chosenConditionId: null,
        chosenMode: 'AUTO',
      })
      .expect(400);
  });

  it('persists ranking metadata for MANUAL and AUTO decisions', async () => {
    const suggestionsRes = await req()
      .post('/api/conditions/suggest')
      .set('Cookie', cookieHeader(medicoCookies))
      .send({ text: 'presión alta persistente', limit: 3 })
      .expect(201);

    await req()
      .post(`/api/conditions/encounters/${encounterId}/suggestion`)
      .set('Cookie', cookieHeader(medicoCookies))
      .send({
        inputText: 'presión alta persistente',
        persistedTextSnapshot: 'presión alta persistente',
        suggestions: suggestionsRes.body,
        chosenConditionId: null,
        chosenMode: 'MANUAL',
      })
      .expect(201);

    const manualLog = await prisma.conditionSuggestionLog.findFirst({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
    });

    expect(manualLog?.chosenMode).toBe('MANUAL');
    expect(manualLog?.chosenConditionId).toBeNull();
    expect(manualLog?.persistedTextSnapshot).toBe('presión alta persistente');
    expect(manualLog?.rankingVersion).toBe(CONDITION_SUGGESTION_RANKING_VERSION);
    expect(JSON.parse(manualLog?.rankingMetadata ?? '{}')).toMatchObject({
      suggestionCount: suggestionsRes.body.length,
      topSuggestionId: suggestionsRes.body[0]?.id ?? null,
      topSuggestionReasons: expect.any(Array),
      chosenSuggestionRank: null,
    });

    const chosenSuggestion = suggestionsRes.body[0];

    await req()
      .post(`/api/conditions/encounters/${encounterId}/suggestion`)
      .set('Cookie', cookieHeader(medicoCookies))
      .send({
        inputText: 'presión alta persistente',
        persistedTextSnapshot: 'presión alta persistente',
        suggestions: suggestionsRes.body,
        chosenConditionId: chosenSuggestion.id,
        chosenMode: 'AUTO',
      })
      .expect(201);

    const autoLog = await prisma.conditionSuggestionLog.findFirst({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
    });

    expect(autoLog?.chosenMode).toBe('AUTO');
    expect(autoLog?.chosenConditionId).toBe(chosenSuggestion.id);
    expect(autoLog?.persistedTextSnapshot).toBe('presión alta persistente');
    expect(autoLog?.rankingVersion).toBe(CONDITION_SUGGESTION_RANKING_VERSION);
    expect(JSON.parse(autoLog?.rankingMetadata ?? '{}')).toMatchObject({
      suggestionCount: suggestionsRes.body.length,
      topSuggestionId: suggestionsRes.body[0]?.id ?? null,
      chosenSuggestionRank: 1,
      chosenSuggestionScore: chosenSuggestion.score,
      chosenSuggestionConfidence: chosenSuggestion.confidence,
      chosenSuggestionReasons: expect.any(Array),
    });
  });
});
