import type { Metadata } from 'next';
import DataRightsRequestShell from '@/components/legal/DataRightsRequestShell';
import { DerechosForm } from './DerechosForm';

export const metadata: Metadata = {
  title: 'Ejercer derechos sobre tus datos personales',
  description:
    'Solicita acceso, rectificacion, supresion, oposicion, portabilidad o bloqueo temporal de tus datos en cumplimiento de la Ley 21.719 de Chile.',
};

export default function DerechosPage() {
  return (
    <DataRightsRequestShell
      backHref="/login"
      backLabel="Volver al acceso"
      eyebrow="Ley 21.719, artículos 4 a 11"
      title="Solicitudes sobre tus datos"
      description="Solicita acceso, rectificación, supresión, oposición, portabilidad o bloqueo temporal de tu información clínica."
      helper="La respuesta se entrega dentro de 30 días corridos, prorrogables por 30 días adicionales según el artículo 11. Si actúas como representante legal, indícalo en el formulario."
      footer={
        <>
          También puedes reclamar ante la Agencia de Protección de Datos Personales de Chile si consideras que tus derechos no fueron respetados.
        </>
      }
    >
        <header className="mb-6 border-b border-surface-muted/70 pb-4">
          <h2 className="portal-title-sm">Crear solicitud pública</h2>
          <p className="portal-copy mt-2">No necesitas cuenta portal. Verificaremos tu identidad antes de entregar información clínica.</p>
        </header>
        <DerechosForm />
    </DataRightsRequestShell>
  );
}
