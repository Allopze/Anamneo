import type { Metadata } from 'next';
import LegalDocumentPage from '@/components/legal/LegalDocumentPage';
import { TERMS_CONTENT } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: TERMS_CONTENT.title,
  description: TERMS_CONTENT.description,
};

export default function TermsPage() {
  return <LegalDocumentPage document={TERMS_CONTENT} />;
}
