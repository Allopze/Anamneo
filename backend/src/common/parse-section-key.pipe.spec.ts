import { ParseSectionKeyPipe } from './parse-section-key.pipe';
import { BadRequestException } from '@nestjs/common';

describe('ParseSectionKeyPipe', () => {
  let pipe: ParseSectionKeyPipe;

  beforeEach(() => {
    pipe = new ParseSectionKeyPipe();
  });

  it('should accept all valid section keys', () => {
    const validKeys = [
      'IDENTIFICACION', 'MOTIVO_CONSULTA', 'ANAMNESIS_PROXIMA',
      'ANAMNESIS_REMOTA', 'REVISION_SISTEMAS', 'EXAMEN_FISICO',
      'SOSPECHA_DIAGNOSTICA', 'TRATAMIENTO', 'RESPUESTA_TRATAMIENTO',
      'OBSERVACIONES',
    ];

    for (const key of validKeys) {
      expect(pipe.transform(key)).toBe(key);
    }
  });

  it('should throw BadRequestException for invalid key', () => {
    expect(() => pipe.transform('INVALID_KEY')).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for empty string', () => {
    expect(() => pipe.transform('')).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for lowercase valid key', () => {
    expect(() => pipe.transform('identificacion')).toThrow(BadRequestException);
  });

  it('should include allowed values in error message', () => {
    try {
      pipe.transform('INVALID');
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.message).toContain('IDENTIFICACION');
      expect(e.message).toContain('OBSERVACIONES');
    }
  });
});
