import { Patient } from '@/types';

type PediatricThresholds = {
  severeThinness: number;
  thinness: number;
  overweight: number;
  obesity: number;
};

const WHO_ADULT_CATEGORIES = [
  { max: 18.5, label: 'Bajo peso' },
  { max: 25, label: 'Normal' },
  { max: 30, label: 'Sobrepeso' },
  { max: 35, label: 'Obesidad grado I' },
  { max: 40, label: 'Obesidad grado II' },
] as const;

const WHO_PEDIATRIC_THRESHOLDS: Record<'female' | 'male', Record<number, PediatricThresholds>> = {
  female: {
    2: { severeThinness: 12.4, thinness: 13.3, overweight: 17.1, obesity: 18.7 },
    3: { severeThinness: 12.1, thinness: 13.1, overweight: 16.8, obesity: 18.4 },
    4: { severeThinness: 11.8, thinness: 12.8, overweight: 16.8, obesity: 18.5 },
    5: { severeThinness: 11.6, thinness: 12.7, overweight: 16.9, obesity: 18.8 },
    6: { severeThinness: 11.7, thinness: 12.7, overweight: 17.0, obesity: 19.2 },
    7: { severeThinness: 11.8, thinness: 12.7, overweight: 17.3, obesity: 19.8 },
    8: { severeThinness: 11.9, thinness: 12.9, overweight: 17.7, obesity: 20.6 },
    9: { severeThinness: 12.1, thinness: 13.1, overweight: 18.3, obesity: 21.5 },
    10: { severeThinness: 12.4, thinness: 13.5, overweight: 19.0, obesity: 22.6 },
    11: { severeThinness: 12.7, thinness: 13.9, overweight: 19.9, obesity: 23.7 },
    12: { severeThinness: 13.2, thinness: 14.4, overweight: 20.8, obesity: 25.0 },
    13: { severeThinness: 13.6, thinness: 14.9, overweight: 21.8, obesity: 26.2 },
    14: { severeThinness: 14.0, thinness: 15.4, overweight: 22.7, obesity: 27.3 },
    15: { severeThinness: 14.4, thinness: 15.9, overweight: 23.5, obesity: 28.2 },
    16: { severeThinness: 14.6, thinness: 16.2, overweight: 24.1, obesity: 28.9 },
    17: { severeThinness: 14.7, thinness: 16.4, overweight: 24.5, obesity: 29.3 },
    18: { severeThinness: 14.7, thinness: 16.4, overweight: 24.8, obesity: 29.5 },
    19: { severeThinness: 14.7, thinness: 16.5, overweight: 25.0, obesity: 29.7 },
  },
  male: {
    2: { severeThinness: 12.9, thinness: 13.8, overweight: 17.3, obesity: 18.9 },
    3: { severeThinness: 12.4, thinness: 13.4, overweight: 16.9, obesity: 18.4 },
    4: { severeThinness: 12.1, thinness: 13.1, overweight: 16.7, obesity: 18.2 },
    5: { severeThinness: 11.9, thinness: 12.9, overweight: 16.6, obesity: 18.3 },
    6: { severeThinness: 12.1, thinness: 13.0, overweight: 16.8, obesity: 18.5 },
    7: { severeThinness: 12.2, thinness: 13.1, overweight: 17.0, obesity: 19.0 },
    8: { severeThinness: 12.4, thinness: 13.3, overweight: 17.4, obesity: 19.7 },
    9: { severeThinness: 12.6, thinness: 13.5, overweight: 17.9, obesity: 20.5 },
    10: { severeThinness: 12.8, thinness: 13.7, overweight: 18.5, obesity: 21.4 },
    11: { severeThinness: 13.1, thinness: 14.1, overweight: 19.2, obesity: 22.5 },
    12: { severeThinness: 13.4, thinness: 14.5, overweight: 19.9, obesity: 23.6 },
    13: { severeThinness: 13.8, thinness: 14.9, overweight: 20.8, obesity: 24.8 },
    14: { severeThinness: 14.3, thinness: 15.5, overweight: 21.8, obesity: 25.9 },
    15: { severeThinness: 14.7, thinness: 16.0, overweight: 22.7, obesity: 27.0 },
    16: { severeThinness: 15.1, thinness: 16.5, overweight: 23.5, obesity: 27.9 },
    17: { severeThinness: 15.4, thinness: 16.9, overweight: 24.3, obesity: 28.6 },
    18: { severeThinness: 15.7, thinness: 17.3, overweight: 24.9, obesity: 29.2 },
    19: { severeThinness: 15.9, thinness: 17.6, overweight: 25.4, obesity: 29.7 },
  },
};

const PEDIATRIC_SEX_MAP: Partial<Record<Patient['sexo'], 'female' | 'male'>> = {
  FEMENINO: 'female',
  MASCULINO: 'male',
};

export interface BmiInterpretation {
  bmi: number;
  bmiLabel: string;
  classification: string;
  reference: string;
  note?: string;
}

export function calculateBmiValue(weightKg?: string | number | null, heightCm?: string | number | null) {
  const weight = typeof weightKg === 'number' ? weightKg : Number.parseFloat(weightKg || '');
  const heightMeters = (typeof heightCm === 'number' ? heightCm : Number.parseFloat(heightCm || '')) / 100;

  if (!Number.isFinite(weight) || !Number.isFinite(heightMeters) || weight <= 0 || heightMeters <= 0) {
    return null;
  }

  return Number((weight / (heightMeters * heightMeters)).toFixed(1));
}

function getAdultWhoClassification(bmi: number) {
  for (const category of WHO_ADULT_CATEGORIES) {
    if (bmi < category.max) {
      return category.label;
    }
  }

  return 'Obesidad grado III';
}

function getPediatricWhoClassification(bmi: number, ageYears: number, sex: Patient['sexo']) {
  const normalizedSex = PEDIATRIC_SEX_MAP[sex];
  if (!normalizedSex) {
    return null;
  }

  const thresholds = WHO_PEDIATRIC_THRESHOLDS[normalizedSex][ageYears];
  if (!thresholds) {
    return null;
  }

  if (bmi < thresholds.severeThinness) {
    return 'Delgadez severa';
  }

  if (bmi < thresholds.thinness) {
    return 'Delgadez';
  }

  if (bmi > thresholds.obesity) {
    return 'Obesidad';
  }

  if (bmi > thresholds.overweight) {
    return 'Sobrepeso';
  }

  return 'Normal';
}

export function getBmiInterpretation(params: {
  weightKg?: string | number | null;
  heightCm?: string | number | null;
  ageYears?: number | null;
  sex?: Patient['sexo'] | null;
}): BmiInterpretation | null {
  const bmi = calculateBmiValue(params.weightKg, params.heightCm);
  if (bmi === null) {
    return null;
  }

  const ageYears = typeof params.ageYears === 'number' ? params.ageYears : null;
  const sex = params.sex ?? null;

  if (typeof ageYears === 'number' && ageYears >= 20) {
    return {
      bmi,
      bmiLabel: bmi.toFixed(1),
      classification: getAdultWhoClassification(bmi),
      reference: 'OMS adultos',
    };
  }

  if (typeof ageYears === 'number' && ageYears >= 2 && ageYears <= 19 && sex) {
    const classification = getPediatricWhoClassification(bmi, ageYears, sex);
    if (classification) {
      return {
        bmi,
        bmiLabel: bmi.toFixed(1),
        classification,
        reference: 'OMS pediátrico',
        note: `Basado en la edad registrada (${ageYears} años).`,
      };
    }
  }

  return {
    bmi,
    bmiLabel: bmi.toFixed(1),
    classification: 'Interpretación OMS no disponible',
    reference: 'IMC calculado',
    note: 'Para pediatría se requiere edad entre 2 y 19 años y sexo masculino o femenino registrado.',
  };
}
