import { SectionKey } from '../common/types';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import { normalizeConditionName } from '../conditions/conditions-helpers';
import { resolveAssociatedConditionLabels } from './clinical-analytics-encounter-utils';
import type {
  RawSection,
  ProbableConditionData,
  ResponseData,
} from './clinical-analytics-encounter';

type ClinicalTreatmentInputEntry = {
  id?: string;
  nombre?: string;
  dosis?: string;
  via?: string;
  frecuencia?: string;
  duracion?: string;
  indicacion?: string;
  estado?: string;
  sospechaId?: string;
};

export type TreatmentOutcomeEntry = NonNullable<ResponseData['resultadosTratamientos']>[number];

export const FAVORABLE_RESPONSE_PATTERNS = [
  'evolucion favorable',
  'buena respuesta',
  'respondio bien',
  'mejoria',
  'mejoro',
  'resuelto',
  'resolvio',
  'sin dolor',
  'sin sintomas',
  'asintomatic',
  'cede',
  'cedio',
];

export const UNFAVORABLE_RESPONSE_PATTERNS = [
  'sin mejoria',
  'no mejora',
  'sin respuesta',
  'persiste',
  'continua con',
  'sigue con',
  'empeoro',
  'empeora',
  'refractario',
  'peor',
];

export function getSectionData<T extends Record<string, unknown>>(sections: RawSection[], sectionKey: SectionKey): T {
  const section = sections.find((entry) => entry.sectionKey === sectionKey);

  if (!section) {
    return {} as T;
  }

  const normalized = formatEncounterSectionForRead({
    sectionKey: section.sectionKey,
    data: section.data,
    schemaVersion: section.schemaVersion,
  });

  return (normalized.data || {}) as T;
}

export function buildTreatmentEntries(
  entries: Array<ClinicalTreatmentInputEntry> | undefined,
  getDetails: (entry: ClinicalTreatmentInputEntry) => string | undefined,
  diagnosisLabelById: Map<string, string>,
  commonAssociatedConditions: string[] | undefined,
  treatmentOutcomes: ResponseData['resultadosTratamientos'] | undefined,
) {
  return (entries || [])
    .map((entry) => {
      const label = entry.nombre?.trim();

      if (!label) {
        return null;
      }

      const linkedConditions = resolveAssociatedConditionLabels(
        entry.sospechaId,
        diagnosisLabelById,
        commonAssociatedConditions,
      );
      const treatmentOutcome = treatmentOutcomes?.find(
        (item: TreatmentOutcomeEntry) => item.treatmentItemId === entry.id,
      );

      return {
        key: normalizeConditionName(label),
        label,
        details: getDetails(entry),
        ...(linkedConditions ? { associatedConditionLabels: linkedConditions } : {}),
        ...(treatmentOutcome?.adherenceStatus ? { adherenceStatus: treatmentOutcome.adherenceStatus } : {}),
        ...(treatmentOutcome?.adverseEventSeverity ? { adverseEventSeverity: treatmentOutcome.adverseEventSeverity } : {}),
        ...(treatmentOutcome?.adverseEventNotes ? { adverseEventNotes: treatmentOutcome.adverseEventNotes } : {}),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}
