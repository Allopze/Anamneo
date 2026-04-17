export type VitalSignField =
  | 'presionArterial'
  | 'frecuenciaCardiaca'
  | 'frecuenciaRespiratoria'
  | 'temperatura'
  | 'saturacionOxigeno';

export interface VitalSignAssessment {
  summary: string;
  detailMessages: string[];
  severity: 'warning' | 'critical';
  createsClinicalAlert: boolean;
}

export type VitalSignAssessmentMap = Partial<Record<VitalSignField, VitalSignAssessment>>;

function parseBloodPressure(value?: string) {
  if (!value) return null;

  const match = value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;

  return {
    systolic: Number.parseInt(match[1], 10),
    diastolic: Number.parseInt(match[2], 10),
  };
}

function parseNumber(value?: string) {
  if (!value) return null;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function assessVitalSigns(signosVitales: Record<string, string | undefined>): VitalSignAssessmentMap {
  const assessments: VitalSignAssessmentMap = {};

  const pressure = parseBloodPressure(signosVitales.presionArterial);
  if (pressure) {
    if (pressure.systolic >= 180 || pressure.diastolic >= 120) {
      const detailMessages: string[] = [];
      if (pressure.systolic >= 180) {
        detailMessages.push(`Presión arterial sistólica crítica: ${signosVitales.presionArterial}`);
      }
      if (pressure.diastolic >= 120) {
        detailMessages.push(`Presión arterial diastólica crítica: ${signosVitales.presionArterial}`);
      }

      assessments.presionArterial = {
        summary: 'Presión arterial en rango crítico',
        detailMessages,
        severity: 'critical',
        createsClinicalAlert: true,
      };
    } else if (pressure.systolic >= 140 || pressure.diastolic >= 90) {
      assessments.presionArterial = {
        summary: 'Hipertensión',
        detailMessages: [`Presión arterial elevada: ${signosVitales.presionArterial}`],
        severity: 'warning',
        createsClinicalAlert: false,
      };
    } else if (pressure.systolic < 90 || pressure.diastolic < 60) {
      assessments.presionArterial = {
        summary: 'Hipotensión',
        detailMessages: [`Presión arterial baja: ${signosVitales.presionArterial}`],
        severity: 'warning',
        createsClinicalAlert: false,
      };
    }
  }

  const heartRate = parseNumber(signosVitales.frecuenciaCardiaca);
  if (heartRate !== null) {
    if (heartRate < 40 || heartRate > 150) {
      assessments.frecuenciaCardiaca = {
        summary: 'Frecuencia cardíaca en rango crítico',
        detailMessages: [`Frecuencia cardíaca en rango crítico: ${heartRate} lpm`],
        severity: 'critical',
        createsClinicalAlert: true,
      };
    } else if (heartRate > 100) {
      assessments.frecuenciaCardiaca = {
        summary: 'Taquicardia',
        detailMessages: [`Frecuencia cardíaca elevada: ${heartRate} lpm`],
        severity: 'warning',
        createsClinicalAlert: false,
      };
    } else if (heartRate < 50) {
      assessments.frecuenciaCardiaca = {
        summary: 'Bradicardia',
        detailMessages: [`Frecuencia cardíaca baja: ${heartRate} lpm`],
        severity: 'warning',
        createsClinicalAlert: false,
      };
    }
  }

  const respiratoryRate = parseNumber(signosVitales.frecuenciaRespiratoria);
  if (respiratoryRate !== null) {
    if (respiratoryRate > 24) {
      assessments.frecuenciaRespiratoria = {
        summary: 'Taquipnea',
        detailMessages: [`Frecuencia respiratoria elevada: ${respiratoryRate} rpm`],
        severity: 'warning',
        createsClinicalAlert: false,
      };
    } else if (respiratoryRate < 10) {
      assessments.frecuenciaRespiratoria = {
        summary: 'Bradipnea',
        detailMessages: [`Frecuencia respiratoria baja: ${respiratoryRate} rpm`],
        severity: 'warning',
        createsClinicalAlert: false,
      };
    }
  }

  const temperature = parseNumber(signosVitales.temperatura);
  if (temperature !== null) {
    if (temperature >= 39.5) {
      assessments.temperatura = {
        summary: 'Temperatura en rango crítico',
        detailMessages: [`Temperatura crítica: ${temperature}°C`],
        severity: 'critical',
        createsClinicalAlert: true,
      };
    } else if (temperature >= 38) {
      assessments.temperatura = {
        summary: 'Fiebre',
        detailMessages: [`Temperatura elevada: ${temperature}°C`],
        severity: 'warning',
        createsClinicalAlert: false,
      };
    } else if (temperature < 35) {
      assessments.temperatura = {
        summary: 'Hipotermia',
        detailMessages: [`Temperatura baja: ${temperature}°C`],
        severity: 'warning',
        createsClinicalAlert: false,
      };
    }
  }

  const oxygenSaturation = parseNumber(signosVitales.saturacionOxigeno);
  if (oxygenSaturation !== null) {
    if (oxygenSaturation < 90) {
      assessments.saturacionOxigeno = {
        summary: 'Saturación de oxígeno en rango crítico',
        detailMessages: [`Saturación de oxígeno crítica: ${oxygenSaturation}%`],
        severity: 'critical',
        createsClinicalAlert: true,
      };
    } else if (oxygenSaturation < 92) {
      assessments.saturacionOxigeno = {
        summary: 'Hipoxemia',
        detailMessages: [`Saturación de oxígeno baja: ${oxygenSaturation}%`],
        severity: 'warning',
        createsClinicalAlert: false,
      };
    }
  }

  return assessments;
}

export function getClinicalAlertMessages(signosVitales: Record<string, string | undefined>) {
  return Object.values(assessVitalSigns(signosVitales))
    .filter((assessment) => assessment.createsClinicalAlert)
    .flatMap((assessment) => assessment.detailMessages);
}