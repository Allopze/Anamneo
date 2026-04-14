import { state, req, cookieHeader } from '../helpers/e2e-setup';

export function conditionsSuite() {
  describe('Conditions', () => {
    it('POST /api/conditions/import/csv/preview → admin can validate global csv with headers', async () => {
      const res = await req()
        .post('/api/conditions/import/csv/preview')
        .set('Cookie', cookieHeader(state.adminCookies))
        .attach(
          'file',
          Buffer.from(
            [
              'name,synonyms,tags',
              'Hipertensión,"hta|presión, alta",cardio',
              'Hipertension,control presión,riesgo',
              'Diabetes,,metabolico',
            ].join('\n'),
          ),
          {
            filename: 'conditions-preview.csv',
            contentType: 'text/csv',
          },
        )
        .expect(201);

      expect(res.body.detectedFormat).toBe('HEADER');
      expect(res.body.totalRows).toBe(3);
      expect(res.body.importableRows).toBe(2);
      expect(res.body.duplicateRows).toBe(1);
      expect(res.body.createCount).toBe(2);
      expect(res.body.invalidRows).toEqual([]);
      expect(res.body.preview[0].synonyms).toEqual(
        expect.arrayContaining(['hta', 'presión, alta', 'control presión']),
      );
    });

    it('POST /api/conditions/import/csv → admin can import global csv', async () => {
      const res = await req()
        .post('/api/conditions/import/csv')
        .set('Cookie', cookieHeader(state.adminCookies))
        .attach(
          'file',
          Buffer.from(
            [
              'name,synonyms,tags',
              'Hipertensión,"hta|presión, alta",cardio',
              'Hipertension,control presión,riesgo',
              'Diabetes,,metabolico',
            ].join('\n'),
          ),
          {
            filename: 'conditions.csv',
            contentType: 'text/csv',
          },
        )
        .expect(201);

      expect(res.body.total).toBe(2);
      expect(res.body.created).toBe(2);
      expect(res.body.duplicateRows).toBe(1);

      const list = await req()
        .get('/api/conditions?search=Hipert')
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      expect(list.body[0].synonyms).toEqual(
        expect.arrayContaining(['hta', 'presión, alta', 'control presión']),
      );
      expect(list.body[0].tags).toEqual(expect.arrayContaining(['cardio', 'riesgo']));
    });

    it('POST /api/conditions/import/csv → medico cannot import global csv', async () => {
      await req()
        .post('/api/conditions/import/csv')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .attach('file', Buffer.from('name\nAsma\n'), {
          filename: 'conditions.csv',
          contentType: 'text/csv',
        })
        .expect(403);
    });

    it('POST /api/conditions/local → assistant can add a local condition once', async () => {
      const res = await req()
        .post('/api/conditions/local')
        .set('Cookie', cookieHeader(state.assistantCookies))
        .send({ name: 'Migraña' })
        .expect(201);

      expect(res.body.name).toBe('Migraña');
      expect(res.body.scope).toBe('LOCAL');
      expect(res.body.deduplicatedByName).toBeUndefined();
      state.localConditionId = res.body.id;
    });

    it('POST /api/conditions/local → normalized duplicates reuse the existing local condition', async () => {
      const res = await req()
        .post('/api/conditions/local')
        .set('Cookie', cookieHeader(state.assistantCookies))
        .send({ name: '  migrana  ' })
        .expect(201);

      expect(res.body.id).toBe(state.localConditionId);
      expect(res.body.name).toBe('migrana');
      expect(res.body.deduplicatedByName).toBe(true);
    });

    it('POST /api/conditions/local → can create a second distinct local condition', async () => {
      const res = await req()
        .post('/api/conditions/local')
        .set('Cookie', cookieHeader(state.assistantCookies))
        .send({ name: 'Asma bronquial' })
        .expect(201);

      expect(res.body.name).toBe('Asma bronquial');
      state.secondLocalConditionId = res.body.id;
    });

    it('PUT /api/conditions/local/:id → rejects renaming to an existing normalized local condition', async () => {
      await req()
        .put(`/api/conditions/local/${state.secondLocalConditionId}`)
        .set('Cookie', cookieHeader(state.assistantCookies))
        .send({ name: 'migraña' })
        .expect(400);
    });
  });
}
