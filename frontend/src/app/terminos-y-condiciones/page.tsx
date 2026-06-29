import type { Metadata } from 'next';
import LegalDocumentLoader from '@/components/legal/LegalDocumentLoader';

export const metadata: Metadata = {
  title: 'Términos y Condiciones de Servicio',
  description: 'Condiciones vigentes de uso de Anamneo.',
};

export default function TermsPage() {
  return <LegalDocumentLoader type="TERMS" />;
}
