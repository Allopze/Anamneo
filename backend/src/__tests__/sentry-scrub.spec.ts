import { scrubPhi as scrub } from '../common/utils/phi-scrub';

describe('Sentry PHI / credential scrub', () => {
  it('redacts Chilean RUT in free-text', () => {
    expect(scrub('error con paciente 12.345.678-9')).toContain('[RUT]');
    expect(scrub('rut 12345678-9 invalido')).toContain('[RUT]');
  });

  it('redacts emails', () => {
    expect(scrub('No se pudo enviar a ana.perez@clinica.cl')).toContain('[EMAIL]');
    expect(scrub('No se pudo enviar a ana.perez@clinica.cl')).not.toContain('ana.perez');
  });

  it('redacts long digit sequences (phones / IDs)', () => {
    expect(scrub('telefono 56987654321')).toContain('[DIGITS]');
  });

  it('redacts SMTP password serialized as JSON', () => {
    const dirty = 'BadRequestException: {"smtpHost":"smtp.x","smtpPassword":"SuperSecret123"}';
    const clean = scrub(dirty)!;
    expect(clean).toContain('"smtpPassword":"[REDACTED]"');
    expect(clean).not.toContain('SuperSecret123');
  });

  it('redacts password / newPassword / totpCode / token field values', () => {
    const dirty = '{"currentPassword":"abc","newPassword":"xyz","totpCode":"123456","token":"abcd"}';
    const clean = scrub(dirty)!;
    expect(clean).toContain('"currentPassword":"[REDACTED]"');
    expect(clean).toContain('"newPassword":"[REDACTED]"');
    expect(clean).toContain('"totpCode":"[REDACTED]"');
    expect(clean).toContain('"token":"[REDACTED]"');
  });

  it('returns undefined when input is undefined or null', () => {
    expect(scrub(undefined)).toBeUndefined();
    expect(scrub(null)).toBeUndefined();
  });
});
