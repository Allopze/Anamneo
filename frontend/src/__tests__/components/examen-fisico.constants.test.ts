import { getVitalAlerts } from '@/components/sections/examen-fisico.constants';

describe('examen-fisico.constants', () => {
  it('maps shared vital-sign assessments to local warnings and automatic clinical alerts', () => {
    const alerts = getVitalAlerts({
      presionArterial: '182/122',
      frecuenciaCardiaca: '110',
      temperatura: '38.4',
      saturacionOxigeno: '89',
    });

    expect(alerts.presionArterial).toEqual(
      expect.objectContaining({
        message: 'Presión arterial en rango crítico',
        severity: 'danger',
        createsClinicalAlert: true,
      }),
    );
    expect(alerts.frecuenciaCardiaca).toEqual(
      expect.objectContaining({
        message: 'Taquicardia',
        severity: 'warning',
        createsClinicalAlert: false,
      }),
    );
    expect(alerts.temperatura).toEqual(
      expect.objectContaining({
        message: 'Fiebre',
        severity: 'warning',
        createsClinicalAlert: false,
      }),
    );
    expect(alerts.saturacionOxigeno).toEqual(
      expect.objectContaining({
        message: 'Saturación de oxígeno en rango crítico',
        severity: 'danger',
        createsClinicalAlert: true,
      }),
    );
  });
});