/**
 * Private helpers and constants for encounter-completion.ts.
 * Not exported from the barrel — import directly only when extending
 * the completion logic.
 */

import type { Encounter, SectionKey } from '@/types';

// ── Required-completion keys ────────────────────────────────────

export const REQUIRED_COMPLETION_SECTION_KEYS: SectionKey[] = [
  'IDENTIFICACION',
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

export const REQUIRED_SEMANTIC_SECTION_KEYS: SectionKey[] = [
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

export const ENCOUNTER_WORKFLOW_SECTION_LABELS: Record<SectionKey, string> = {
  IDENTIFICACION: 'Identificación',
  MOTIVO_CONSULTA: 'Motivo de consulta',
  ANAMNESIS_PROXIMA: 'Anamnesis próxima',
  ANAMNESIS_REMOTA: 'Anamnesis remota',
  REVISION_SISTEMAS: 'Revisión por sistemas',
  EXAMEN_FISICO: 'Examen físico',
  SOSPECHA_DIAGNOSTICA: 'Sospecha diagnóstica',
  TRATAMIENTO: 'Tratamiento',
  RESPUESTA_TRATAMIENTO: 'Respuesta al tratamiento',
  OBSERVACIONES: 'Observaciones',
};

// ── Helpers ─────────────────────────────────────────────────────

export function hasMeaningfulContent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulContent(item));
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) =>
      hasMeaningfulContent(item),
    );
  }

  return false;
}

export function formatSectionKeyList(sectionKeys: SectionKey[]) {
  return sectionKeys.map((key) => ENCOUNTER_WORKFLOW_SECTION_LABELS[key]).join(', ');
}

/**
 * Labels legibles (con tildes y formato) para campos del diff de firma, por
 * nombre de segmento. Lo que no esté aquí cae al transform camelCase de abajo.
 */
const DIFF_FIELD_LABELS: Record<string, string> = {
  // Identificación
  rut: 'RUT',
  rutExempt: 'Exención de RUT',
  rutExemptReason: 'Motivo de exención de RUT',
  nombre: 'Nombre',
  edad: 'Edad',
  edadMeses: 'Edad (meses)',
  sexo: 'Sexo',
  trabajo: 'Trabajo',
  prevision: 'Previsión',
  domicilio: 'Domicilio',
  fechaNacimiento: 'Fecha de nacimiento',
  completenessStatus: 'Estado de la ficha',
  registrationMode: 'Modo de registro',
  // Secciones clínicas comunes
  motivoConsulta: 'Motivo de consulta',
  sospechaDiagnostica: 'Sospecha diagnóstica',
  examenFisico: 'Examen físico',
};

export function formatDiffPathLabel(path: string) {
  return path
    .split('.')
    .map((segment) => {
      if (/^\d+$/.test(segment)) {
        return `#${segment}`;
      }

      if (DIFF_FIELD_LABELS[segment]) {
        return DIFF_FIELD_LABELS[segment];
      }

      const normalized = segment
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim();

      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(' > ');
}

export function flattenMeaningfulValues(
  value: unknown,
  prefix = '',
  output: Record<string, string> = {},
) {
  if (value === null || value === undefined) {
    return output;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized) {
      output[prefix || 'value'] = normalized;
    }
    return output;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    output[prefix || 'value'] = String(value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flattenMeaningfulValues(
        item,
        prefix ? `${prefix}.${index + 1}` : String(index + 1),
        output,
      );
    });
    return output;
  }

  if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([key, nestedValue]) => {
        flattenMeaningfulValues(nestedValue, prefix ? `${prefix}.${key}` : key, output);
      });
  }

  return output;
}

export function buildAttachmentSignatureLabel(
  attachment: NonNullable<Encounter['attachments']>[number],
) {
  return (
    attachment.linkedOrderLabel?.trim() ||
    attachment.description?.trim() ||
    attachment.originalName?.trim() ||
    'Adjunto sin nombre'
  );
}
