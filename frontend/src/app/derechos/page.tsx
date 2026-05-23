import type { Metadata } from 'next';
import { DerechosForm } from './DerechosForm';

export const metadata: Metadata = {
  title: 'Ejercer derechos sobre tus datos personales',
  description:
    'Solicita acceso, rectificacion, supresion, oposicion, portabilidad o bloqueo temporal de tus datos en cumplimiento de la Ley 21.719 de Chile.',
};

export default function DerechosPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-wide text-teal-700">Ley 21.719 — Art 4 a 11</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Ejercer tus derechos sobre datos personales
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Como titular de datos personales tienes derecho a solicitar:
            <strong> acceso</strong>, <strong>rectificación</strong>,{' '}
            <strong>supresión</strong>, <strong>oposición</strong>,{' '}
            <strong>portabilidad</strong> y <strong>bloqueo temporal</strong> de
            tu información. Tu solicitud sera respondida dentro de 30 dias
            corridos (prorrogables por 30 dias adicionales segun el Art 11).
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Si actúas como padre, madre, tutor o representante legal de un
            paciente, indícalo en el formulario.
          </p>
        </header>
        <DerechosForm />
        <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500">
          También puedes reclamar ante la Agencia de Protección de Datos
          Personales de Chile si consideras que tus derechos no fueron
          respetados (Ley 21.719 Art 41).
        </footer>
      </div>
    </main>
  );
}
