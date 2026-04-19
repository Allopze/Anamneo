import { listVitalSignAssessments } from '../../../../shared/vital-sign-alerts';

describe('vital-sign-alerts shared helpers', () => {
  it('returns normalized assessment entries with primary detail for frontend consumers', () => {
    const assessments = listVitalSignAssessments({
      presionArterial: '170/100',
      temperatura: '38.2',
      saturacionOxigeno: '91',
    });

    expect(assessments).toEqual([
      expect.objectContaining({
        field: 'presionArterial',
        summary: 'Hipertensión',
        primaryDetail: 'Presión arterial elevada: 170/100',
        severity: 'warning',
      }),
      expect.objectContaining({
        field: 'temperatura',
        summary: 'Fiebre',
        primaryDetail: 'Temperatura elevada: 38.2°C',
        severity: 'warning',
      }),
      expect.objectContaining({
        field: 'saturacionOxigeno',
        summary: 'Hipoxemia',
        primaryDetail: 'Saturación de oxígeno baja: 91%',
        severity: 'warning',
      }),
    ]);
  });
});
