export function parseHistoryField(field: any): any {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      return { texto: field };
    }
  }
  return field;
}

export function historyFieldHasContent(field: any): boolean {
  const parsed = parseHistoryField(field);
  const hasItems = Array.isArray(parsed?.items) && parsed.items.length > 0;
  const hasText = typeof parsed?.texto === 'string' && parsed.texto.trim().length > 0;
  return hasItems || hasText;
}

const PATIENT_HISTORY_CONTENT_FIELDS = [
  'antecedentesMedicos',
  'antecedentesQuirurgicos',
  'antecedentesGinecoobstetricos',
  'antecedentesFamiliares',
  'habitos',
  'medicamentos',
  'alergias',
  'inmunizaciones',
  'antecedentesSociales',
  'antecedentesPersonales',
] as const;

export function patientHistoryHasContent(history: Record<string, any> | null | undefined): boolean {
  if (!history) return false;
  return PATIENT_HISTORY_CONTENT_FIELDS.some((field) => historyFieldHasContent(history[field]));
}

/**
 * Obtiene el primer nombre de un string, ignorando títulos comunes (Dr., Dra., etc.)
 */
export function getFirstName(fullName: string | undefined | null): string {
  if (!fullName) return '';
  
  const titles = [
    'dr.', 'dra.', 'dr', 'dra', 
    'sr.', 'sra.', 'sr', 'sra',
    'prof.', 'prof', 'msc.', 'msc', 'phd.', 'phd',
    'médico', 'médica', 'enfermero', 'enfermera'
  ];
  
  const parts = fullName.trim().split(/\s+/);
  
  // Buscar la primera parte que no sea un título
  for (const part of parts) {
    if (!titles.includes(part.toLowerCase())) {
      return part;
    }
  }
  
  // Si todo son "títulos", devolver la primera parte por defecto
  return parts[0] || '';
}

/**
 * Obtiene la inicial del nombre real, ignorando títulos
 */
export function getNameInitial(fullName: string | undefined | null): string {
  const firstName = getFirstName(fullName);
  return firstName.charAt(0).toUpperCase();
}
