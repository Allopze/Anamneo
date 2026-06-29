import { cookieHeader, req, state } from '../helpers/e2e-setup';

export function onboardingSuite() {
  describe('Onboarding', () => {
    it('GET /api/onboarding/me → returns medico onboarding state', async () => {
      const res = await req()
        .get('/api/onboarding/me')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.eligible).toBe(true);
      expect(res.body.role).toBe('MEDICO');
      expect(res.body.version).toBe('clinical-v1');
      expect(res.body.steps.map((step: any) => step.id)).toContain('create_encounter');
      expect(res.body.completedStepIds).toEqual([]);
    });

    it('PATCH /api/onboarding/me → persists progress for current user', async () => {
      const patchRes = await req()
        .patch('/api/onboarding/me')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ completedStepIds: ['review_dashboard', 'create_patient'] })
        .expect(200);

      expect(patchRes.body.completedStepIds).toEqual(['review_dashboard', 'create_patient']);
      expect(patchRes.body.isComplete).toBe(false);

      const getRes = await req()
        .get('/api/onboarding/me')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(getRes.body.completedStepIds).toEqual(['review_dashboard', 'create_patient']);
    });

    it('keeps onboarding progress isolated between users', async () => {
      const assistantRes = await req()
        .get('/api/onboarding/me')
        .set('Cookie', cookieHeader(state.assistantCookies))
        .expect(200);

      expect(assistantRes.body.eligible).toBe(true);
      expect(assistantRes.body.role).toBe('ASISTENTE');
      expect(assistantRes.body.completedStepIds).toEqual([]);
      expect(assistantRes.body.steps.map((step: any) => step.id)).toContain('support_encounter');
      expect(assistantRes.body.steps.map((step: any) => step.id)).not.toContain('create_encounter');
    });

    it('POST /api/onboarding/me/reset → clears current user progress', async () => {
      await req()
        .post('/api/onboarding/me/reset')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      const res = await req()
        .get('/api/onboarding/me')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.completedStepIds).toEqual([]);
      expect(res.body.completedAt).toBeNull();
    });
  });
}
