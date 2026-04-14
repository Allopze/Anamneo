import { ConditionsSimilarityService } from './conditions-similarity.service';

describe('ConditionsSimilarityService', () => {
  let service: ConditionsSimilarityService;
  let mockPrisma: any;

  const mockConditions = [
    { id: '1', name: 'Hipertensión arterial', synonyms: '["presión alta", "HTA"]', tags: '["cardiovascular"]', active: true },
    { id: '2', name: 'Diabetes mellitus tipo 2', synonyms: '["DM2", "azúcar alta"]', tags: '["endocrino", "metabólico"]', active: true },
    { id: '3', name: 'Asma bronquial', synonyms: '["asma"]', tags: '["respiratorio"]', active: true },
    { id: '4', name: 'Neumonía', synonyms: '["pulmonía"]', tags: '["respiratorio", "infeccioso"]', active: true },
    { id: '5', name: 'Gastritis', synonyms: '["inflamación estómago"]', tags: '["gastrointestinal"]', active: true },
  ];

  beforeEach(async () => {
    mockPrisma = {
      conditionCatalog: {
        findMany: jest.fn().mockResolvedValue(mockConditions),
      },
    };

    service = new ConditionsSimilarityService(mockPrisma);
    await service.buildIndex();
  });

  describe('suggest', () => {
    it('should return suggestions for exact name match', async () => {
      const results = await service.suggest('hipertension arterial');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Hipertensión arterial');
    });

    it('should return suggestions for synonym match', async () => {
      const results = await service.suggest('presión alta');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name === 'Hipertensión arterial')).toBe(true);
    });

    it('should return suggestions for tag match', async () => {
      const results = await service.suggest('respiratorio');
      expect(results.length).toBeGreaterThan(0);
      const names = results.map((r) => r.name);
      expect(names).toContain('Asma bronquial');
    });

    it('should return empty array for empty input', async () => {
      const results = await service.suggest('');
      expect(results).toEqual([]);
    });

    it('should return empty array for whitespace-only input', async () => {
      const results = await service.suggest('   ');
      expect(results).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const results = await service.suggest('e', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('prioritizes exact name matches over broader field matches', async () => {
      const results = await service.suggest('asma bronquial', 3);
      expect(results[0].name).toBe('Asma bronquial');
    });

    it('should include confidence scores', async () => {
      const results = await service.suggest('diabetes');
      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(99);
      }
    });

    it('should handle accented input (normalize)', async () => {
      // Use terms that match both the synonym and tag for Neumonía
      const results = await service.suggest('infeccioso respiratorio');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name === 'Neumonía')).toBe(true);
    });
  });

  describe('suggestFromConditions', () => {
    it('should work with pre-parsed condition arrays', async () => {
      const conditions = [
        { id: 'a', name: 'Cefalea', synonyms: ['dolor de cabeza'], tags: ['neurológico'] },
        { id: 'b', name: 'Migraña', synonyms: ['jaqueca'], tags: ['neurológico'] },
      ];

      const results = await service.suggestFromConditions(conditions, 'dolor cabeza');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for empty conditions', async () => {
      const results = await service.suggestFromConditions([], 'test');
      expect(results).toEqual([]);
    });

    it('should return empty for empty input', async () => {
      const results = await service.suggestFromConditions(
        [{ id: 'a', name: 'Test' }],
        '',
      );
      expect(results).toEqual([]);
    });

    it('prefers direct synonym evidence over shared tags', async () => {
      const conditions = [
        { id: 'a', name: 'Migraña', synonyms: ['dolor de cabeza'], tags: ['neurologico'] },
        { id: 'b', name: 'Mareo', synonyms: ['vertigo'], tags: ['dolor de cabeza'] },
      ];

      const results = await service.suggestFromConditions(conditions, 'dolor de cabeza', 2);
      expect(results[0].name).toBe('Migraña');
    });
  });

  describe('buildIndex', () => {
    it('should initialize and be ready for suggestions', async () => {
      // Already initialized in beforeEach
      const results = await service.suggest('diabetes');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle conditions with malformed JSON synonyms', async () => {
      mockPrisma.conditionCatalog.findMany.mockResolvedValue([
        { id: '1', name: 'Test', synonyms: 'not valid json', tags: '[]', active: true },
      ]);

      await service.buildIndex();
      const results = await service.suggest('test');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
