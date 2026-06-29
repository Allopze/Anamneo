import { registerSchema } from '@/app/register/register.constants';

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

  it('keeps legal acceptance as the user-facing consent gate only', () => {
    const result = registerSchema.safeParse(validRegisterPayload);

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('acceptedTermsVersion');
    expect(result.data).not.toHaveProperty('acceptedPrivacyVersion');
  });
});
