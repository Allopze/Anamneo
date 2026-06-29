import Link from 'next/link';
import { FiArrowRight } from 'react-icons/fi';

export default function RegisterFooter() {
  return (
    <div className="space-y-3">
      <p className="text-center text-ink-secondary">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="auth-inline-link">
          Iniciar sesión <FiArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </p>
      <p className="text-center text-xs text-ink-muted">
        <Link href="/forgot-password" className="auth-inline-link">
          Recuperar contraseña
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-ink-muted">
        <Link href="/terminos-y-condiciones" className="auth-inline-link">
          Términos
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/politica-de-privacidad" className="auth-inline-link">
          Privacidad
        </Link>
      </div>
    </div>
  );
}
