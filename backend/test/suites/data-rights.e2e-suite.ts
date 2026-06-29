import { req } from '../helpers/e2e-setup';

/**
 * E2E mínimo del flujo publico de solicitudes de derechos del titular
 * (Ley 21.719 Art 4-11).
 */
export function dataRightsSuite() {
  describe('Data rights (Ley 21.719 Art 4-11)', () => {
    it('POST /api/public/derechos → 201 con dueDate ~30 dias', async () => {
      const res = await req()
        .post('/api/public/derechos')
        .send({
          requesterName: `Test Titular ${Date.now()}`,
          requesterEmail: `test-${Date.now()}@example.com`,
          requestType: 'ACCESO',
          payloadRequest: 'Solicito copia de mis datos personales (e2e test).',
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status', 'RECIBIDA');
      expect(res.body).toHaveProperty('dueDate');
      const dueDateMs = new Date(res.body.dueDate).getTime();
      const expectedMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
      // tolerancia 30 segundos
      expect(Math.abs(dueDateMs - expectedMs)).toBeLessThan(30_000);
    });

    it('POST /api/public/derechos → 400 con payload invalido (requestType faltante)', async () => {
      const res = await req()
        .post('/api/public/derechos')
        .send({
          requesterName: 'Test',
          requesterEmail: 'test@example.com',
          payloadRequest: 'Solicito copia.',
        });
      expect([400, 422]).toContain(res.status);
    });

    it('POST /api/public/derechos → 400 con email invalido', async () => {
      const res = await req()
        .post('/api/public/derechos')
        .send({
          requesterName: 'Test',
          requesterEmail: 'no-es-email',
          requestType: 'ACCESO',
          payloadRequest: 'Solicito copia de mis datos.',
        });
      expect([400, 422]).toContain(res.status);
    });

    it('GET /api/admin/data-requests → 401 sin autenticacion', async () => {
      const res = await req().get('/api/admin/data-requests');
      expect(res.status).toBe(401);
    });
  });
}
