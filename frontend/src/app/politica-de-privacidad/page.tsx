import type { Metadata } from 'next';
import LegalDocumentPage from '@/components/legal/LegalDocumentPage';
import { PRIVACY_CONTENT } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: PRIVACY_CONTENT.title,
  description: PRIVACY_CONTENT.description,
};

export default function PrivacyPage() {
  return <LegalDocumentPage document={PRIVACY_CONTENT} />;
}
