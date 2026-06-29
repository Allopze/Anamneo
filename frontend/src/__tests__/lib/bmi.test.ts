import { calculateBmiValue, getBmiInterpretation } from '@/lib/bmi';

describe('calculateBmiValue', () => {
  it('calculates bmi from weight and height', () => {
    expect(calculateBmiValue('70', '170')).toBe(24.2);
  });

  it('returns null for incomplete values', () => {
    expect(calculateBmiValue('', '170')).toBeNull();
  });
});

describe('getBmiInterpretation', () => {
  it('uses WHO adult cut-offs for adults', () => {
    expect(
      getBmiInterpretation({
        weightKg: '70',
        heightCm: '170',
        ageYears: 34,
        sex: 'FEMENINO',
      }),
    ).toEqual(
      expect.objectContaining({
        classification: 'Normal',
        reference: 'OMS adultos',
      }),
    );
  });

  it('uses WHO pediatric cut-offs for pediatric patients', () => {
    expect(
      getBmiInterpretation({
        weightKg: '34',
        heightCm: '130',
        ageYears: 9,
        sex: 'MASCULINO',
      }),
    ).toEqual(
      expect.objectContaining({
        classification: 'Sobrepeso',
        reference: 'OMS pediátrico',
      }),
    );
  });

  it('falls back when pediatric interpretation is not available', () => {
    expect(
      getBmiInterpretation({
        weightKg: '20',
        heightCm: '110',
        ageYears: 6,
        sex: 'OTRO',
      }),
    ).toEqual(
      expect.objectContaining({
        classification: 'Interpretación OMS no disponible',
      }),
    );
  });
});
