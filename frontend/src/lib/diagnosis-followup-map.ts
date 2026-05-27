import type { EncounterSection } from '@/types';
import type { SospechaDiagnostica } from '@/types/encounter.types';
import { addDays, format } from 'date-fns';

interface FollowupEntry {
  keywords: string[];
  days: number;
}

const FOLLOWUP_MAP: FollowupEntry[] = [
  { keywords: ['hipertensión', 'hipertension', 'hta', 'presión alta', 'presion alta'], days: 90 },
  { keywords: ['diabetes', 'dm2', 'dm 2', 'dm tipo 2', 'diabético', 'diabetico'], days: 90 },
  { keywords: ['hipotiroidismo', 'hipotiroideo'], days: 90 },
  { keywords: ['asma', 'broncoespasmo', 'bronquial'], days: 180 },
  { keywords: ['itu', 'infección urinaria', 'infeccion urinaria', 'iac', 'cistitis', 'pielonefritis'], days: 7 },
  { keywords: ['faringoamigdalitis', 'faringitis', 'amigdalitis', 'otitis'], days: 7 },
  { keywords: ['ira alta', 'resfriado', 'resfrío', 'rino', 'rinitis'], days: 7 },
  { keywords: ['bronquitis', 'neumonía', 'neumonia', 'bronconeumonía', 'bronconeumonia'], days: 14 },
  { keywords: ['hipercolesterolemia', 'dislipidemia', 'colesterol'], days: 90 },
  { keywords: ['artrosis', 'artritis', 'artralgia', 'articular'], days: 180 },
  { keywords: ['depresión', 'depresion', 'ansiedad', 'trastorno ansioso', 'trastorno depresivo'], days: 30 },
  { keywords: ['epilepsia', 'convulsión', 'convulsion'], days: 90 },
  { keywords: ['insuficiencia cardíaca', 'insuficiencia cardiaca', 'ic con', 'ic preserv'], days: 30 },
  { keywords: ['fibrilación auricular', 'fibrilacion auricular', 'fa '], days: 30 },
  { keywords: ['dolor lumbar', 'lumbago', 'lumbalgia', 'cervicalgia', 'dorsalgia'], days: 14 },
  { keywords: ['herida', 'sutura', 'curación', 'curacion', 'traumatismo'], days: 7 },
  { keywords: ['gastritis', 'úlcera gástrica', 'ulcera gastrica', 'gerd', 'reflujo'], days: 30 },
];

function normalizeDiagnosisText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export interface FollowupSuggestion {
  days: number;
  diagnosisText: string;
  suggestedDate: string;
}

export function getSuggestedFollowup(sections: EncounterSection[]): FollowupSuggestion | null {
  const diagSection = sections.find((s) => s.sectionKey === 'SOSPECHA_DIAGNOSTICA');
  if (!diagSection?.data) return null;

  const sospechas = (diagSection.data.sospechas ?? []) as SospechaDiagnostica[];
  if (sospechas.length === 0) return null;

  const sorted = [...sospechas].sort((a, b) => a.prioridad - b.prioridad);

  for (const s of sorted) {
    const normalized = normalizeDiagnosisText(s.diagnostico);
    for (const entry of FOLLOWUP_MAP) {
      const hit = entry.keywords.some((kw) =>
        normalizeDiagnosisText(kw).split(' ').every((part) => normalized.includes(part)),
      );
      if (hit) {
        const suggestedDate = format(addDays(new Date(), entry.days), 'yyyy-MM-dd');
        return { days: entry.days, diagnosisText: s.diagnostico, suggestedDate };
      }
    }
  }

  return null;
}
