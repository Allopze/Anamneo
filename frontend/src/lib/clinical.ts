import {
  Encounter,
  ExamenFisicoData,
  HistoryFieldValue,
  MotivoConsultaData,
  RevisionSistemasData,
  RespuestaTratamientoData,
  SectionKey,
  SospechaDiagnosticaData,
  StructuredMedication,
  StructuredOrder,
  TratamientoData,
} from '@/types';
import { parseHistoryField } from '@/lib/utils';

export function getSectionData<T>(encounter: Encounter | undefined, key: SectionKey): T {
  return (encounter?.sections?.find((section) => section.sectionKey === key)?.data || {}) as T;
}

export function getTreatmentPlanText(tratamiento: Partial<TratamientoData> | undefined) {
  const plan = tratamiento?.plan?.trim() || '';
  const indicaciones = tratamiento?.indicaciones?.trim() || '';

  if (!plan) {
    return indicaciones;
  }

  if (!indicaciones || indicaciones === plan) {
    return plan;
  }

  return `${plan}\n\nIndicaciones adicionales:\n${indicaciones}`;
}

export function formatHistoryFieldText(field: HistoryFieldValue | string | null | undefined) {
  const parsed = parseHistoryField(field);
  if (!parsed) {
    return '';
  }

  const items = Array.isArray(parsed.items)
    ? parsed.items.map((item: string) => item.trim()).filter(Boolean)
    : [];
  const text = typeof parsed.texto === 'string'
    ? parsed.texto.trim()
    : typeof parsed === 'string'
    ? parsed.trim()
    : '';

  if (!items.length) {
    return text;
  }

  if (!text) {
    return items.join(', ');
  }

  return `${items.join(', ')}. ${text}`;
}

export function formatRevisionSystemLabel(key: string) {
  const normalized = key.replace(/([A-Z])/g, ' $1').trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getRevisionSystemEntries(revision: RevisionSistemasData | undefined) {
  if (revision?.negativa) {
    return [
      {
        key: 'negativa',
        label: 'Resultado',
        text: 'Negativa, nada que reportar',
      },
    ];
  }

  return Object.entries(revision || {})
    .map(([key, value]) => {
      if (!value || typeof value !== 'object') {
        return null;
      }

      const checked = Boolean((value as { checked?: boolean }).checked);
      const rawNotes = (value as { notas?: string }).notas;
      const notes = typeof rawNotes === 'string' ? rawNotes.trim() : '';

      if (!checked && !notes) {
        return null;
      }

      return {
        key,
        label: formatRevisionSystemLabel(key),
        text: notes || 'Sin hallazgos descritos',
      };
    })
    .filter((entry): entry is { key: string; label: string; text: string } => entry !== null);
}

export function buildEncounterSummary(encounter: Encounter): string[] {
  const motivo = getSectionData<MotivoConsultaData>(encounter, 'MOTIVO_CONSULTA');
  const diagnostico = getSectionData<SospechaDiagnosticaData>(encounter, 'SOSPECHA_DIAGNOSTICA');
  const tratamiento = getSectionData<TratamientoData>(encounter, 'TRATAMIENTO');
  const respuesta = getSectionData<RespuestaTratamientoData>(encounter, 'RESPUESTA_TRATAMIENTO');

  const lines: string[] = [];

  if (motivo.texto?.trim()) {
    lines.push(motivo.texto.trim());
  }

  if (diagnostico.sospechas?.length) {
    lines.push(`Dx: ${diagnostico.sospechas.slice(0, 3).map((item) => item.diagnostico).filter(Boolean).join(', ')}`);
  }

  const treatmentPlan = getTreatmentPlanText(tratamiento);
  if (treatmentPlan) {
    lines.push(`Plan: ${treatmentPlan}`);
  }

  if (respuesta.planSeguimiento?.trim()) {
    lines.push(`Seguimiento: ${respuesta.planSeguimiento.trim()}`);
  }

  return lines.slice(0, 4);
}

export function extractStructuredMedicationLines(medications: StructuredMedication[] | undefined) {
  return (medications || [])
    .map((item) => [item.nombre, item.dosis, item.via, item.frecuencia, item.duracion].filter(Boolean).join(' · '))
    .filter(Boolean);
}

export function extractStructuredOrderLines(orders: StructuredOrder[] | undefined) {
  return (orders || [])
    .map((item) => [item.nombre, item.estado, item.indicacion].filter(Boolean).join(' · '))
    .filter(Boolean);
}

export function extractVitalTrend(encounters: Encounter[] | undefined) {
  return (encounters || [])
    .map((encounter) => {
      const examen = getSectionData<ExamenFisicoData>(encounter, 'EXAMEN_FISICO');
      const signos = examen.signosVitales;
      if (!signos) return null;
      return {
        encounterId: encounter.id,
        createdAt: encounter.createdAt,
        presionArterial: signos.presionArterial || null,
        peso: signos.peso ? Number(signos.peso) : null,
        imc: signos.imc ? Number(signos.imc) : null,
        temperatura: signos.temperatura ? Number(signos.temperatura) : null,
        saturacionOxigeno: signos.saturacionOxigeno ? Number(signos.saturacionOxigeno) : null,
      };
    })
    .filter(Boolean) as Array<{
      encounterId: string;
      createdAt: string;
      presionArterial: string | null;
      peso: number | null;
      imc: number | null;
      temperatura: number | null;
      saturacionOxigeno: number | null;
    }>;
}

export function buildGeneratedClinicalSummary(encounter: Encounter) {
  const motivo = getSectionData<MotivoConsultaData>(encounter, 'MOTIVO_CONSULTA');
  const diagnostico = getSectionData<SospechaDiagnosticaData>(encounter, 'SOSPECHA_DIAGNOSTICA');
  const tratamiento = getSectionData<TratamientoData>(encounter, 'TRATAMIENTO');
  const respuesta = getSectionData<RespuestaTratamientoData>(encounter, 'RESPUESTA_TRATAMIENTO');

  const parts = [
    motivo.texto?.trim(),
    diagnostico.sospechas?.length
      ? `Sospecha diagnóstica: ${diagnostico.sospechas
          .slice(0, 3)
          .map((item) => item.diagnostico)
          .filter(Boolean)
          .join(', ')}.`
      : '',
    getTreatmentPlanText(tratamiento) ? `Tratamiento: ${getTreatmentPlanText(tratamiento)}.` : '',
    extractStructuredMedicationLines(tratamiento.medicamentosEstructurados).length
      ? `Medicamentos: ${extractStructuredMedicationLines(tratamiento.medicamentosEstructurados).join('; ')}.`
      : '',
    extractStructuredOrderLines(tratamiento.examenesEstructurados).length
      ? `Exámenes: ${extractStructuredOrderLines(tratamiento.examenesEstructurados).join('; ')}.`
      : '',
    respuesta.planSeguimiento?.trim() ? `Seguimiento: ${respuesta.planSeguimiento.trim()}.` : '',
  ].filter(Boolean);

  return parts.join(' ');
}
