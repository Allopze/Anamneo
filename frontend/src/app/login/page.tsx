import { Suspense } from 'react';
import { LoginFallback } from './LoginFallback';
import { LoginClient } from './LoginClient';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}
