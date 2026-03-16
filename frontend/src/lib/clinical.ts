import {
  Encounter,
  ExamenFisicoData,
  MotivoConsultaData,
  RespuestaTratamientoData,
  SectionKey,
  SospechaDiagnosticaData,
  StructuredMedication,
  StructuredOrder,
  TratamientoData,
} from '@/types';

export function getSectionData<T>(encounter: Encounter | undefined, key: SectionKey): T {
  return (encounter?.sections?.find((section) => section.sectionKey === key)?.data || {}) as T;
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

  if (tratamiento.plan?.trim()) {
    lines.push(`Plan: ${tratamiento.plan.trim()}`);
  }

  if (respuesta.planSeguimiento?.trim()) {
    lines.push(`Seguimiento: ${respuesta.planSeguimiento.trim()}`);
  }

  return lines.slice(0, 4);
}

export function extractStructuredMedicationLines(medications: StructuredMedication[] | undefined) {
  return (medications || [])
    .map((item) => [item.nombre, item.dosis, item.frecuencia, item.duracion].filter(Boolean).join(' · '))
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
    tratamiento.plan?.trim() ? `Tratamiento: ${tratamiento.plan.trim()}.` : '',
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
