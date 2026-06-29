import { SectionKey } from '../common/types';
import { normalizeConditionName } from '../conditions/conditions-helpers';

type EncounterDiagnosisRecord = {
  source: 'AFECCION_PROBABLE' | 'SOSPECHA_DIAGNOSTICA';
  label: string;
  normalizedLabel: string;
  code?: string | null;
  sourceEntryId?: string;
};

type EncounterTreatmentRecord = {
  treatmentType: 'MEDICATION' | 'EXAM' | 'REFERRAL';
  sourceItemId?: string;
  label: string;
  normalizedLabel: string;
  details?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  indication?: string;
  status?: string;
  diagnosisKey?: string;
  diagnosisSourceEntryId?: string;
};

function normalizeTreatmentLabel(label: string) {
  return normalizeConditionName(label);
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getSection<T>(sections: Array<{ sectionKey: string; data: unknown }>, key: SectionKey) {
  return sections.find((section) => section.sectionKey === key) as
    | ({ sectionKey: string; data: T })
    | undefined;
}

export function buildEncounterDiagnoses(sections: Array<{ sectionKey: string; data: unknown }>) {
  const probableSection = getSection<{ afeccionSeleccionada?: { name?: string } }>(sections, 'MOTIVO_CONSULTA');
  const diagnosticSection = getSection<{ sospechas?: Array<{ id?: string; diagnostico?: string; codigoCie10?: string; descripcionCie10?: string }> }>(
    sections,
    'SOSPECHA_DIAGNOSTICA',
  );

  const probableDiagnoses: EncounterDiagnosisRecord[] = [];
  if (probableSection?.data?.afeccionSeleccionada?.name) {
    const label = probableSection.data.afeccionSeleccionada.name.trim();
    if (label) {
      probableDiagnoses.push({
        source: 'AFECCION_PROBABLE',
        label,
        normalizedLabel: normalizeConditionName(label),
        code: null,
      });
    }
  }

  const diagnosticDiagnoses: EncounterDiagnosisRecord[] = [];
  for (const sospecha of diagnosticSection?.data?.sospechas ?? []) {
    const label = ((sospecha.diagnostico || sospecha.descripcionCie10) ?? '').trim();
    const code = sospecha.codigoCie10?.trim() || null;
    if (!label && !code) {
      continue;
    }

    diagnosticDiagnoses.push({
      source: 'SOSPECHA_DIAGNOSTICA',
      label: label || code || 'Diagnóstico sin etiqueta',
      normalizedLabel: normalizeConditionName(label || code || ''),
      code,
      sourceEntryId: typeof sospecha.id === 'string' && sospecha.id.trim().length > 0 ? sospecha.id.trim() : undefined,
    });
  }

  return uniqueBy([...probableDiagnoses, ...diagnosticDiagnoses], (entry) => `${entry.source}:${entry.normalizedLabel}:${entry.code ?? ''}`);
}

export function buildEncounterTreatments(
  sections: Array<{ sectionKey: string; data: unknown }>,
  diagnoses: EncounterDiagnosisRecord[],
) {
  const tratamientoSection = getSection<{
    medicamentosEstructurados?: Array<Record<string, unknown>>;
    examenesEstructurados?: Array<Record<string, unknown>>;
    derivacionesEstructuradas?: Array<Record<string, unknown>>;
  }>(sections, 'TRATAMIENTO');

  const diagnosisKey = diagnoses.length === 1 ? diagnoses[0].normalizedLabel : undefined;

  const medicationRows = (tratamientoSection?.data?.medicamentosEstructurados ?? [])
    .map((entry) => {
      const nombre = (entry.nombre as string | undefined)?.trim();
      const activeIngredient = (entry.activeIngredient as string | undefined)?.trim();
      const label = nombre || activeIngredient;
      if (!label) {
        return null;
      }

      const details = [
        entry.dosis,
        entry.via,
        entry.frecuencia,
        entry.duracion,
      ]
        .filter(Boolean)
        .join(' · ')
        .trim();

      return {
        treatmentType: 'MEDICATION' as const,
        sourceItemId: (entry.id as string | undefined)?.trim() || undefined,
        label,
        normalizedLabel: normalizeTreatmentLabel(label),
        details: details || undefined,
        dose: (entry.dosis as string | undefined) || undefined,
        route: (entry.via as string | undefined) || undefined,
        frequency: (entry.frecuencia as string | undefined) || undefined,
        duration: (entry.duracion as string | undefined) || undefined,
        indication: (entry.indicacion as string | undefined) || undefined,
        status: undefined,
        diagnosisKey,
        diagnosisSourceEntryId: (entry.sospechaId as string | undefined)?.trim() || undefined,
      };
    })
    .filter(Boolean) as EncounterTreatmentRecord[];

  const examRows = (tratamientoSection?.data?.examenesEstructurados ?? [])
    .map((entry) => {
      const label = (entry.nombre as string | undefined)?.trim();
      if (!label) {
        return null;
      }

      const details = [entry.estado, entry.indicacion].filter(Boolean).join(' · ').trim();

      return {
        treatmentType: 'EXAM' as const,
        sourceItemId: (entry.id as string | undefined)?.trim() || undefined,
        label,
        normalizedLabel: normalizeTreatmentLabel(label),
        details: details || undefined,
        indication: (entry.indicacion as string | undefined) || undefined,
        status: (entry.estado as string | undefined) || undefined,
        diagnosisKey,
        diagnosisSourceEntryId: (entry.sospechaId as string | undefined)?.trim() || undefined,
      };
    })
    .filter(Boolean) as EncounterTreatmentRecord[];

  const referralRows = (tratamientoSection?.data?.derivacionesEstructuradas ?? [])
    .map((entry) => {
      const label = (entry.nombre as string | undefined)?.trim();
      if (!label) {
        return null;
      }

      const details = [entry.estado, entry.indicacion].filter(Boolean).join(' · ').trim();

      return {
        treatmentType: 'REFERRAL' as const,
        sourceItemId: (entry.id as string | undefined)?.trim() || undefined,
        label,
        normalizedLabel: normalizeTreatmentLabel(label),
        details: details || undefined,
        indication: (entry.indicacion as string | undefined) || undefined,
        status: (entry.estado as string | undefined) || undefined,
        diagnosisKey,
        diagnosisSourceEntryId: (entry.sospechaId as string | undefined)?.trim() || undefined,
      };
    })
    .filter(Boolean) as EncounterTreatmentRecord[];

  return [...medicationRows, ...examRows, ...referralRows];
}

export function buildEncounterOutcome(
  sections: Array<{ sectionKey: string; data: unknown }>,
  treatments: EncounterTreatmentRecord[],
) {
  const respuestaSection = getSection<{
    respuestaEstructurada?: { estado?: string; notas?: string };
    resultadosTratamientos?: Array<{
      treatmentItemId?: string;
      estado?: string;
      notas?: string;
      adherenceStatus?: string;
      adverseEventSeverity?: string;
      adverseEventNotes?: string;
    }>;
    evolucion?: string;
    resultadosExamenes?: string;
    ajustesTratamiento?: string;
    planSeguimiento?: string;
  }>(sections, 'RESPUESTA_TRATAMIENTO');

  const structuredStatus = respuestaSection?.data?.respuestaEstructurada?.estado;
  const textNotes = [
    respuestaSection?.data?.respuestaEstructurada?.notas,
    respuestaSection?.data?.evolucion,
    respuestaSection?.data?.resultadosExamenes,
  ]
    .filter(Boolean)
    .join(' \n')
    .trim();

  const status = structuredStatus ?? (textNotes ? 'UNKNOWN' : 'UNKNOWN');
  const source = structuredStatus ? 'ESTRUCTURADO' : textNotes ? 'TEXTO' : 'UNKNOWN';
  const explicitOutcomeEntries: Array<readonly [string, {
    status: string;
    source: 'ESTRUCTURADO' | 'TEXTO';
    notes?: string;
    adherenceStatus?: string;
    adverseEventSeverity?: string;
    adverseEventNotes?: string;
  }]> = [];

  for (const entry of respuestaSection?.data?.resultadosTratamientos ?? []) {
    const treatmentItemId = entry.treatmentItemId?.trim();
    if (!treatmentItemId) {
      continue;
    }

    const explicitStatus = entry.estado?.trim();
    const explicitNotes = entry.notas?.trim();
    const explicitAdherenceStatus = entry.adherenceStatus?.trim();
    const explicitAdverseEventSeverity = entry.adverseEventSeverity?.trim();
    const explicitAdverseEventNotes = entry.adverseEventNotes?.trim();
    if (!explicitStatus && !explicitNotes && !explicitAdherenceStatus && !explicitAdverseEventSeverity && !explicitAdverseEventNotes) {
      continue;
    }

    explicitOutcomeEntries.push([
      treatmentItemId,
      {
        status: explicitStatus ?? 'UNKNOWN',
        source: explicitStatus ? 'ESTRUCTURADO' : 'TEXTO',
        notes: explicitNotes || undefined,
        adherenceStatus: explicitAdherenceStatus || undefined,
        adverseEventSeverity: explicitAdverseEventSeverity || undefined,
        adverseEventNotes: explicitAdverseEventNotes || undefined,
      },
    ]);
  }

  const explicitOutcomeByItemId = new Map(explicitOutcomeEntries);

  return treatments.flatMap((treatment, index) => {
    const explicitOutcome = treatment.sourceItemId ? explicitOutcomeByItemId.get(treatment.sourceItemId) : undefined;
    const fallbackOutcome = structuredStatus || textNotes
      ? {
          status,
          source,
          notes: textNotes || undefined,
          adherenceStatus: undefined,
          adverseEventSeverity: undefined,
          adverseEventNotes: undefined,
        }
      : null;
    const selectedOutcome = explicitOutcome ?? fallbackOutcome;

    if (!selectedOutcome) {
      return [];
    }

    return [{
      treatmentIndex: index,
      status: selectedOutcome.status,
      source: selectedOutcome.source,
      notes: selectedOutcome.notes,
      adherenceStatus: selectedOutcome.adherenceStatus,
      adverseEventSeverity: selectedOutcome.adverseEventSeverity,
      adverseEventNotes: selectedOutcome.adverseEventNotes,
    }];
  });
}
