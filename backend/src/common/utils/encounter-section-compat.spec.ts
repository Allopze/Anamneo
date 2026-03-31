import { formatEncounterSectionForRead, upgradeEncounterSectionData } from './encounter-section-compat';

describe('encounter-section-compat', () => {
  it('upgrades OBSERVACIONES from schemaVersion 1 to 2', () => {
    expect(
      upgradeEncounterSectionData({
        sectionKey: 'OBSERVACIONES',
        schemaVersion: 1,
        data: { observaciones: 'Seguimiento estable' },
      }),
    ).toEqual({
      data: {
        observaciones: 'Seguimiento estable',
        resumenClinico: '',
      },
      schemaVersion: 2,
    });
  });

  it('keeps newer OBSERVACIONES payloads intact on read', () => {
    expect(
      formatEncounterSectionForRead({
        id: 'section-1',
        sectionKey: 'OBSERVACIONES',
        schemaVersion: 2,
        data: {
          observaciones: 'Notas adicionales',
          resumenClinico: 'Paciente en mejoría',
        },
      }),
    ).toMatchObject({
      schemaVersion: 2,
      data: {
        observaciones: 'Notas adicionales',
        resumenClinico: 'Paciente en mejoría',
      },
    });
  });

  it('fails fast when a payload is newer than the supported schema version', () => {
    expect(() =>
      upgradeEncounterSectionData({
        sectionKey: 'MOTIVO_CONSULTA',
        schemaVersion: 2,
        data: { texto: 'Control' },
      }),
    ).toThrow('newer than supported version');
  });
});
