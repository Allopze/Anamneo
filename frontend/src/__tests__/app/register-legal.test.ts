import { registerSchema } from '@/app/register/register.constants';
import { LEGAL_DOCUMENT_VERSION } from '../../../../shared/legal-contract';

const validRegisterPayload = {
  nombre: 'Dra. Camila Soto',
  email: 'camila@example.cl',
  password: 'Password1',
  confirmPassword: 'Password1',
  role: 'ADMIN' as const,
  acceptedLegal: true,
};

describe('register legal acceptance', () => {
  it('requires legal acceptance in the register schema', () => {
    const result = registerSchema.safeParse({
      ...validRegisterPayload,
      acceptedLegal: false,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['acceptedLegal']);
  });

  it('exposes the current legal version to registration payloads', () => {
    expect(LEGAL_DOCUMENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
