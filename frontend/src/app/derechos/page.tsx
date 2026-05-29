import type { Metadata } from 'next';
import { DerechosForm } from './DerechosForm';

export const metadata: Metadata = {
  title: 'Ejercer derechos sobre tus datos personales',
  description:
    'Solicita acceso, rectificacion, supresion, oposicion, portabilidad o bloqueo temporal de tus datos en cumplimiento de la Ley 21.719 de Chile.',
};

export default function DerechosPage() {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-10 text-ink">
      <div className="mx-auto max-w-2xl rounded-card border border-surface-muted/70 bg-surface-elevated p-6 shadow-card sm:p-8">
        <header className="mb-6">
          <p className="text-sm font-semibold text-auth-teal">Ley 21.719, artículos 4 a 11</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">
            Ejercer tus derechos sobre datos personales
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-secondary">
            Como titular de datos personales tienes derecho a solicitar:
            <strong> acceso a una copia de tu ficha clínica</strong>, <strong>rectificación</strong>,{' '}
            <strong>supresión</strong>, <strong>oposición</strong>,{' '}
            <strong>portabilidad</strong> y <strong>bloqueo temporal</strong> de
            tu información. Tu solicitud será respondida dentro de 30 días
            corridos (prorrogables por 30 días adicionales según el artículo 11).
          </p>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            Si actúas como padre, madre, tutor o representante legal de un
            paciente, indícalo en el formulario.
          </p>
        </header>
        <DerechosForm />
        <footer className="mt-8 border-t border-surface-muted/70 pt-4 text-xs leading-5 text-ink-muted">
          También puedes reclamar ante la Agencia de Protección de Datos
          Personales de Chile si consideras que tus derechos no fueron
          respetados (Ley 21.719 Art 41).
        </footer>
      </div>
    </main>
  );
}
