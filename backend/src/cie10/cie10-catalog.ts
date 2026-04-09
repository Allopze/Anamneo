/**
 * CIE-10 (ICD-10) search service.
 *
 * In production, load the full CIE-10-ES dataset into the `entries` array
 * from an official source (e.g., Ministerio de Salud / OMS).
 * This module ships with a curated seed of common codes used in primary care.
 */

export interface Cie10Entry {
  code: string;
  description: string;
  chapter: string;
}

/** Curated seed — extend via loadCie10Dataset() */
const SEED: Cie10Entry[] = [
  { code: 'J06.9', description: 'Infección aguda de las vías respiratorias superiores, no especificada', chapter: 'X' },
  { code: 'J20.9', description: 'Bronquitis aguda, no especificada', chapter: 'X' },
  { code: 'J18.9', description: 'Neumonía, no especificada', chapter: 'X' },
  { code: 'J45.9', description: 'Asma, no especificada', chapter: 'X' },
  { code: 'I10', description: 'Hipertensión esencial (primaria)', chapter: 'IX' },
  { code: 'I25.9', description: 'Enfermedad isquémica crónica del corazón, no especificada', chapter: 'IX' },
  { code: 'I50.9', description: 'Insuficiencia cardíaca, no especificada', chapter: 'IX' },
  { code: 'E11.9', description: 'Diabetes mellitus tipo 2, sin complicaciones', chapter: 'IV' },
  { code: 'E10.9', description: 'Diabetes mellitus tipo 1, sin complicaciones', chapter: 'IV' },
  { code: 'E78.5', description: 'Hiperlipidemia, no especificada', chapter: 'IV' },
  { code: 'E03.9', description: 'Hipotiroidismo, no especificado', chapter: 'IV' },
  { code: 'E66.9', description: 'Obesidad, no especificada', chapter: 'IV' },
  { code: 'K21.0', description: 'Enfermedad por reflujo gastroesofágico con esofagitis', chapter: 'XI' },
  { code: 'K29.7', description: 'Gastritis, no especificada', chapter: 'XI' },
  { code: 'K59.0', description: 'Constipación', chapter: 'XI' },
  { code: 'N39.0', description: 'Infección de vías urinarias, sitio no especificado', chapter: 'XIV' },
  { code: 'N18.9', description: 'Enfermedad renal crónica, no especificada', chapter: 'XIV' },
  { code: 'M54.5', description: 'Lumbago no especificado', chapter: 'XIII' },
  { code: 'M79.3', description: 'Paniculitis, no especificada', chapter: 'XIII' },
  { code: 'M25.5', description: 'Dolor articular', chapter: 'XIII' },
  { code: 'G43.9', description: 'Migraña, no especificada', chapter: 'VI' },
  { code: 'G47.0', description: 'Insomnio', chapter: 'VI' },
  { code: 'F32.9', description: 'Episodio depresivo, no especificado', chapter: 'V' },
  { code: 'F41.1', description: 'Trastorno de ansiedad generalizada', chapter: 'V' },
  { code: 'F41.9', description: 'Trastorno de ansiedad, no especificado', chapter: 'V' },
  { code: 'R50.9', description: 'Fiebre, no especificada', chapter: 'XVIII' },
  { code: 'R10.4', description: 'Otros dolores abdominales y los no especificados', chapter: 'XVIII' },
  { code: 'R51', description: 'Cefalea', chapter: 'XVIII' },
  { code: 'R05', description: 'Tos', chapter: 'XVIII' },
  { code: 'L30.9', description: 'Dermatitis, no especificada', chapter: 'XII' },
  { code: 'B34.9', description: 'Infección viral, no especificada', chapter: 'I' },
  { code: 'A09', description: 'Diarrea y gastroenteritis de presunto origen infeccioso', chapter: 'I' },
  { code: 'Z00.0', description: 'Examen médico general', chapter: 'XXI' },
  { code: 'Z13.9', description: 'Examen de pesquisa especial, no especificado', chapter: 'XXI' },
];

let entries: Cie10Entry[] = [...SEED];

/** Replace the built-in seed with a full dataset */
export function loadCie10Dataset(data: Cie10Entry[]) {
  entries = data;
}

/** Search by code or description (case-insensitive, accent-insensitive) */
export function searchCie10(query: string, limit = 20): Cie10Entry[] {
  const normalized = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return entries
    .filter((e) => {
      const code = e.code.toLowerCase();
      const desc = e.description
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return code.includes(normalized) || desc.includes(normalized);
    })
    .slice(0, limit);
}
