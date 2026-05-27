import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recuperar contraseña',
  description: 'Recupera el acceso a tu cuenta Anamneo.',
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
