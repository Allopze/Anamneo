export const BODY_PARTS = [
  { key: 'cabeza', label: 'Cabeza' },
  { key: 'cuello', label: 'Cuello' },
  { key: 'torax', label: 'Tórax' },
  { key: 'abdomen', label: 'Abdomen' },
  { key: 'extremidades', label: 'Extremidades' },
];

export const ESTADO_GENERAL_OPTIONS = [
  { value: '', label: 'Sin registrar' },
  { value: 'BUEN_ESTADO', label: 'Buen estado general' },
  { value: 'REGULAR_ESTADO', label: 'Regular estado general' },
  { value: 'MAL_ESTADO', label: 'Mal estado general' },
];

export interface VitalAlert {
  message: string;
  severity: 'warning' | 'danger';
}

export function getVitalAlerts(signosVitales: Record<string, string | undefined>): Record<string, VitalAlert> {
  const alerts: Record<string, VitalAlert> = {};

  // Blood pressure
  const pa = signosVitales.presionArterial;
  if (pa) {
    const match = pa.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (match) {
      const sys = parseInt(match[1], 10);
      const dia = parseInt(match[2], 10);
      if (sys >= 180 || dia >= 120) {
        alerts.presionArterial = { message: 'Crisis hipertensiva', severity: 'danger' };
      } else if (sys >= 140 || dia >= 90) {
        alerts.presionArterial = { message: 'Hipertensión', severity: 'warning' };
      } else if (sys < 90 || dia < 60) {
        alerts.presionArterial = { message: 'Hipotensión', severity: 'warning' };
      }
    }
  }

  // Heart rate
  const fc = parseFloat(signosVitales.frecuenciaCardiaca || '');
  if (fc) {
    if (fc > 120) {
      alerts.frecuenciaCardiaca = { message: 'Taquicardia significativa', severity: 'danger' };
    } else if (fc > 100) {
      alerts.frecuenciaCardiaca = { message: 'Taquicardia', severity: 'warning' };
    } else if (fc < 50) {
      alerts.frecuenciaCardiaca = { message: 'Bradicardia', severity: 'warning' };
    }
  }

  // Respiratory rate
  const fr = parseFloat(signosVitales.frecuenciaRespiratoria || '');
  if (fr) {
    if (fr > 24) {
      alerts.frecuenciaRespiratoria = { message: 'Taquipnea', severity: 'warning' };
    } else if (fr < 10) {
      alerts.frecuenciaRespiratoria = { message: 'Bradipnea', severity: 'danger' };
    }
  }

  // Temperature
  const temp = parseFloat(signosVitales.temperatura || '');
  if (temp) {
    if (temp >= 39) {
      alerts.temperatura = { message: 'Fiebre alta', severity: 'danger' };
    } else if (temp >= 38) {
      alerts.temperatura = { message: 'Fiebre', severity: 'warning' };
    } else if (temp < 35) {
      alerts.temperatura = { message: 'Hipotermia', severity: 'danger' };
    }
  }

  // SpO2
  const sat = parseFloat(signosVitales.saturacionOxigeno || '');
  if (sat) {
    if (sat < 90) {
      alerts.saturacionOxigeno = { message: 'Hipoxemia severa', severity: 'danger' };
    } else if (sat < 92) {
      alerts.saturacionOxigeno = { message: 'Hipoxemia', severity: 'warning' };
    }
  }

  return alerts;
}

export function calculateImc(signosVitales: Record<string, string | undefined>): string | undefined {
  const peso = parseFloat(signosVitales.peso || '');
  const talla = parseFloat(signosVitales.talla || '') / 100; // cm to m
  if (peso > 0 && talla > 0) {
    return (peso / (talla * talla)).toFixed(1);
  }
  return undefined;
}
