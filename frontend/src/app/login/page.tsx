import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginFallback } from './LoginFallback';
import { LoginClient } from './LoginClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Accede a tu espacio clínico Anamneo.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}
