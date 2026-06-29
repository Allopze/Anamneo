import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Crea tu cuenta en Anamneo para acceder a tu espacio clínico.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
