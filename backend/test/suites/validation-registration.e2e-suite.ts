import { state, prisma, req, extractCookies, cookieHeader } from '../helpers/e2e-setup';
import {
  ENCOUNTER_SECTION_ORDER,
  getEncounterSectionSchemaVersion,
} from '../../src/common/utils/encounter-section-meta';

export function validationRegistrationSuite() {
  describe('Validation', () => {
    it('POST /api/auth/register → invalid email format', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'Valid123', nombre: 'Test' })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('POST /api/auth/register → weak password', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({ email: 'weak@test.com', password: '12345678', nombre: 'Test' })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('POST /api/auth/register → rejects public registration with valid password but no invitation', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({ email: 'dotpass@test.com', password: 'Dot.Pass123', nombre: 'Dot Test', role: 'MEDICO' })
        .expect(403);

      expect(String(res.body.message)).toContain('invitación');
    });

    it('POST /api/auth/register → rejects password with spaces', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({ email: 'spacepass@test.com', password: 'Space Pass123', nombre: 'Space Test', role: 'MEDICO' })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('POST /api/patients → missing required fields', async () => {
      await req().post('/api/patients').set('Cookie', cookieHeader(state.medicoCookies)).send({ nombre: 'Test' }).expect(400);
    });
  });

}
