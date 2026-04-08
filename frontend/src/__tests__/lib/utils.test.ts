import {
  parseHistoryField,
  historyFieldHasContent,
  patientHistoryHasContent,
  getFirstName,
  getNameInitial,
} from '@/lib/utils';

describe('parseHistoryField', () => {
  it('parses a JSON string into object', () => {
    expect(parseHistoryField('{"key":"value"}')).toEqual({ key: 'value' });
  });

  it('wraps non-JSON string in texto field', () => {
    expect(parseHistoryField('plain text')).toEqual({ texto: 'plain text' });
  });

  it('returns object as-is', () => {
    const obj = { a: 1 };
    expect(parseHistoryField(obj)).toBe(obj);
  });

  it('returns null/undefined as-is', () => {
    expect(parseHistoryField(null)).toBeNull();
    expect(parseHistoryField(undefined)).toBeUndefined();
  });

  it('returns arrays as-is', () => {
    const arr = [1, 2];
    expect(parseHistoryField(arr)).toBe(arr);
  });
});

describe('historyFieldHasContent', () => {
  it('returns true for JSON payload with items', () => {
    expect(historyFieldHasContent('{"items":["HTA"]}')).toBe(true);
  });

  it('returns true for plain text strings', () => {
    expect(historyFieldHasContent('Alergia a penicilina')).toBe(true);
  });

  it('returns false for empty values', () => {
    expect(historyFieldHasContent(null)).toBe(false);
    expect(historyFieldHasContent('{"items":[],"texto":"   "}')).toBe(false);
  });
});

describe('patientHistoryHasContent', () => {
  it('detects content in mixed stored history fields', () => {
    expect(patientHistoryHasContent({
      antecedentesMedicos: '{"items":["HTA"]}',
      alergias: '',
    })).toBe(true);
  });

  it('returns false when every history field is empty', () => {
    expect(patientHistoryHasContent({
      antecedentesMedicos: '{"items":[],"texto":""}',
      alergias: null,
    })).toBe(false);
  });

  it('ignores metadata fields when clinical history is empty', () => {
    expect(patientHistoryHasContent({
      id: 'history-1',
      patientId: 'patient-1',
      updatedAt: '2026-04-08T00:00:00.000Z',
      antecedentesMedicos: '{"items":[],"texto":""}',
      antecedentesQuirurgicos: null,
      antecedentesGinecoobstetricos: null,
      antecedentesFamiliares: null,
      habitos: null,
      medicamentos: null,
      alergias: null,
      inmunizaciones: null,
      antecedentesSociales: null,
      antecedentesPersonales: null,
    })).toBe(false);
  });
});

describe('getFirstName', () => {
  it('returns first name from full name', () => {
    expect(getFirstName('Juan Pérez')).toBe('Juan');
  });

  it('skips Dr. title', () => {
    expect(getFirstName('Dr. Carlos López')).toBe('Carlos');
  });

  it('skips Dra. title', () => {
    expect(getFirstName('Dra. María González')).toBe('María');
  });

  it('skips multiple titles', () => {
    expect(getFirstName('Dr. Prof. Roberto Silva')).toBe('Roberto');
  });

  it('returns empty for null/undefined', () => {
    expect(getFirstName(null)).toBe('');
    expect(getFirstName(undefined)).toBe('');
    expect(getFirstName('')).toBe('');
  });

  it('handles single word name', () => {
    expect(getFirstName('Ana')).toBe('Ana');
  });

  it('falls back to first part if all are titles', () => {
    expect(getFirstName('Dr.')).toBe('Dr.');
  });
});

describe('getNameInitial', () => {
  it('returns first letter uppercase', () => {
    expect(getNameInitial('juan pérez')).toBe('J');
  });

  it('skips title and uses real name initial', () => {
    expect(getNameInitial('Dr. carlos')).toBe('C');
  });

  it('returns empty for falsy input', () => {
    expect(getNameInitial(null)).toBe('');
  });
});
