export function formatSospechaDiagnosticaLabel(sospecha: Record<string, unknown>) {
  const diagnostico = typeof sospecha.diagnostico === 'string' ? sospecha.diagnostico.trim() : '';
  const codigoCie10 = typeof sospecha.codigoCie10 === 'string' ? sospecha.codigoCie10.trim() : '';
  const descripcionCie10 =
    typeof sospecha.descripcionCie10 === 'string' ? sospecha.descripcionCie10.trim() : '';

  const baseLabel = diagnostico || descripcionCie10 || 'Diagnóstico sin descripción';
  if (!codigoCie10) return baseLabel;
  if (descripcionCie10) return `${baseLabel} (${codigoCie10}: ${descripcionCie10})`;
  return `${baseLabel} (${codigoCie10})`;
}

export function getTreatmentPlanText(trat: Record<string, any>) {
  const plan = typeof trat.plan === 'string' ? trat.plan.trim() : '';
  const indicaciones = typeof trat.indicaciones === 'string' ? trat.indicaciones.trim() : '';

  if (!plan) return indicaciones;
  if (!indicaciones || indicaciones === plan) return plan;
  return `${plan}\n\nIndicaciones adicionales:\n${indicaciones}`;
}

export function formatStructuredMedicationLine(item: Record<string, unknown>) {
  const nombre = typeof item.nombre === 'string' ? item.nombre.trim() : '';
  const activeIngredient = typeof item.activeIngredient === 'string' ? item.activeIngredient.trim() : '';
  const activeIngredientLabel = activeIngredient && activeIngredient.toLowerCase() !== nombre.toLowerCase()
    ? `PA: ${activeIngredient}`
    : '';
  const dosis = typeof item.dosis === 'string' ? item.dosis.trim() : '';
  const via = typeof item.via === 'string' ? item.via.trim() : '';
  const frecuencia = typeof item.frecuencia === 'string' ? item.frecuencia.trim() : '';
  const duracion = typeof item.duracion === 'string' ? item.duracion.trim() : '';

  return [nombre, activeIngredientLabel, dosis, via, frecuencia, duracion].filter(Boolean).join(' · ');
}

export function formatHistoryFieldText(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object' || Array.isArray(value)) return '';

  const record = value as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? record.items
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const text = typeof record.texto === 'string' ? record.texto.trim() : '';

  if (!items.length) return text;
  if (!text) return items.join(', ');
  return `${items.join(', ')}. ${text}`;
}

export function formatRevisionSystemEntries(revision: Record<string, any>) {
  return Object.entries(revision || {})
    .map(([key, value]) => {
      if (!value || typeof value !== 'object') return null;

      const checked = Boolean((value as { checked?: boolean }).checked);
      const rawNotes = (value as { notas?: string }).notas;
      const notes = typeof rawNotes === 'string' ? rawNotes.trim() : '';

      if (!checked && !notes) return null;

      return {
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()),
        text: notes || 'Sin hallazgos descritos',
      };
    })
    .filter((entry): entry is { label: string; text: string } => entry !== null);
}
