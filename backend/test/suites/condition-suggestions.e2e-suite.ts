import { cookieHeader, prisma, req, state } from '../helpers/e2e-setup';
import { CONDITION_SUGGESTION_RANKING_VERSION } from '../../src/conditions/conditions-suggestion-log';

export function conditionSuggestionsSuite() {
  describe('Condition Suggestions', () => {
    it('POST /api/conditions/suggest → medico can fetch ranked suggestions for encounter text', async () => {
      const res = await req()
        .post('/api/conditions/suggest')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ text: 'presión alta persistente', limit: 3 })
        .expect(201);

      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        confidence: expect.any(Number),
      });
    });

    it('POST /api/conditions/encounters/:encounterId/suggestion → rejects inconsistent AUTO payloads', async () => {
      const suggestionsRes = await req()
        .post('/api/conditions/suggest')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ text: 'presión alta persistente', limit: 3 })
        .expect(201);

      await req()
        .post(`/api/conditions/encounters/${state.encounterId}/suggestion`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          inputText: 'presión alta persistente',
          suggestions: suggestionsRes.body,
          chosenConditionId: null,
          chosenMode: 'AUTO',
        })
        .expect(400);
    });

    it('POST /api/conditions/encounters/:encounterId/suggestion → persists manual decisions with null chosenConditionId', async () => {
      const suggestionsRes = await req()
        .post('/api/conditions/suggest')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ text: 'presión alta persistente', limit: 3 })
        .expect(201);

      await req()
        .post(`/api/conditions/encounters/${state.encounterId}/suggestion`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          inputText: 'presión alta persistente',
          persistedTextSnapshot: 'presión alta persistente',
          suggestions: suggestionsRes.body,
          chosenConditionId: null,
          chosenMode: 'MANUAL',
        })
        .expect(201);

      const log = await prisma.conditionSuggestionLog.findFirst({
        where: { encounterId: state.encounterId },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).not.toBeNull();
      expect(log?.chosenMode).toBe('MANUAL');
      expect(log?.chosenConditionId).toBeNull();
      expect(log?.persistedTextSnapshot).toBe('presión alta persistente');
      expect(log?.rankingVersion).toBe(CONDITION_SUGGESTION_RANKING_VERSION);
      expect(JSON.parse(log?.rankingMetadata ?? '{}')).toMatchObject({
        suggestionCount: suggestionsRes.body.length,
        topSuggestionId: suggestionsRes.body[0]?.id ?? null,
        topSuggestionReasons: expect.any(Array),
        chosenSuggestionRank: null,
      });
    });

    it('POST /api/conditions/encounters/:encounterId/suggestion → persists ranking metadata for AUTO decisions', async () => {
      const suggestionsRes = await req()
        .post('/api/conditions/suggest')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ text: 'presión alta persistente', limit: 3 })
        .expect(201);

      const chosenSuggestion = suggestionsRes.body[1] ?? suggestionsRes.body[0];

      await req()
        .post(`/api/conditions/encounters/${state.encounterId}/suggestion`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          inputText: 'presión alta persistente',
          persistedTextSnapshot: 'presión alta persistente',
          suggestions: suggestionsRes.body,
          chosenConditionId: chosenSuggestion.id,
          chosenMode: 'AUTO',
        })
        .expect(201);

      const log = await prisma.conditionSuggestionLog.findFirst({
        where: { encounterId: state.encounterId },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).not.toBeNull();
      expect(log?.chosenMode).toBe('AUTO');
      expect(log?.chosenConditionId).toBe(chosenSuggestion.id);
      expect(log?.persistedTextSnapshot).toBe('presión alta persistente');
      expect(log?.rankingVersion).toBe(CONDITION_SUGGESTION_RANKING_VERSION);
      expect(JSON.parse(log?.rankingMetadata ?? '{}')).toMatchObject({
        suggestionCount: suggestionsRes.body.length,
        topSuggestionId: suggestionsRes.body[0]?.id ?? null,
        chosenSuggestionRank: suggestionsRes.body.findIndex((item: { id: string }) => item.id === chosenSuggestion.id) + 1,
        chosenSuggestionScore: chosenSuggestion.score,
        chosenSuggestionConfidence: chosenSuggestion.confidence,
        chosenSuggestionReasons: expect.any(Array),
      });
    });
  });
}
