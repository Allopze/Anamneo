import { assessVitalSigns } from '../../../../shared/vital-sign-alerts';

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
  createsClinicalAlert: boolean;
  detailMessages: string[];
}

export function getVitalAlerts(signosVitales: Record<string, string | undefined>): Record<string, VitalAlert> {
  return Object.fromEntries(
    Object.entries(assessVitalSigns(signosVitales)).map(([field, assessment]) => [
      field,
      {
        message: assessment.summary,
        severity: assessment.severity === 'critical' ? 'danger' : 'warning',
        createsClinicalAlert: assessment.createsClinicalAlert,
        detailMessages: assessment.detailMessages,
      },
    ]),
  );
}

export function calculateImc(signosVitales: Record<string, string | undefined>): string | undefined {
  const peso = parseFloat(signosVitales.peso || '');
  const talla = parseFloat(signosVitales.talla || '') / 100; // cm to m
  if (peso > 0 && talla > 0) {
    return (peso / (talla * talla)).toFixed(1);
  }
  return undefined;
}
