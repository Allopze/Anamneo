import { sanitizeSospechaDiagnosticaData } from './encounters-sanitize';

describe('EncountersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves CIE-10 fields when sanitizing diagnostic suspicions', () => {
    expect(
      sanitizeSospechaDiagnosticaData({
        sospechas: [
          {
            id: 'dx-1',
            codigoCie10: 'A09',
            descripcionCie10: 'Gastroenteritis y colitis de origen no especificado',
            notas: 'Persistente por 48 horas',
          },
        ],
      }),
    ).toEqual({
      sospechas: [
        {
          id: 'dx-1',
          diagnostico: 'Gastroenteritis y colitis de origen no especificado',
          codigoCie10: 'A09',
          descripcionCie10: 'Gastroenteritis y colitis de origen no especificado',
          prioridad: 1,
          notas: 'Persistente por 48 horas',
        },
      ],
    });
  });
});
