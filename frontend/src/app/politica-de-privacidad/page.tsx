import type { Metadata } from 'next';
import LegalDocumentLoader from '@/components/legal/LegalDocumentLoader';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Tratamiento vigente de datos del personal de salud y pacientes en Anamneo.',
};

export default function PrivacyPage() {
  return <LegalDocumentLoader type="PRIVACY" />;
}
