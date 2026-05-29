'use client';

import { FiFileText } from 'react-icons/fi';
import { EmptyState } from '@/components/common/EmptyState';
import { DataProcessingConsent } from './types';
import { formatConsentDate, purposeLabel } from './utils';

interface Props {
  consents: DataProcessingConsent[];
  isLoading: boolean;
  onRevoke: (consent: DataProcessingConsent) => void;
}

export default function ConsentHistoryList({ consents, isLoading, onRevoke }: Props) {
  if (isLoading) {
    return <p className="text-xs text-ink-muted">Cargando consentimientos…</p>;
  }

  if (consents.length === 0) {
    return (
      <EmptyState
        icon={<FiFileText className="h-6 w-6" aria-hidden="true" />}
        title="Sin consentimientos registrados"
        description="No hay consentimientos de tratamiento de datos personales registrados para este paciente."
      />
    );
  }

  return (
    <ul className="space-y-2 text-sm">
      {consents.map((consent) => (
        <li
          key={consent.id}
          className={`rounded-card border p-3 ${consent.revokedAt ? 'border-status-red/20 bg-status-red/10' : 'border-status-green/30 bg-status-green/10'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-ink-primary">
                {purposeLabel(consent.purpose)}
                {consent.revokedAt ? ' — REVOCADO' : ' — Vigente'}
              </p>
              <p className="text-xs text-ink-secondary">
                Firmante: {consent.signerName} ({consent.signerRelationship}) · método {consent.method}
              </p>
              <p className="text-xs text-ink-muted">
                Otorgado: {formatConsentDate(consent.grantedAt)} hrs
                {consent.revokedAt ? ` · Revocado: ${formatConsentDate(consent.revokedAt)} hrs` : ''}
              </p>
              {consent.legalDocument && (
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  Política: {consent.legalDocument.title} v{consent.legalDocument.version}
                </p>
              )}
              <p className="font-mono text-[10px] text-ink-muted">
                hash: {consent.evidenceHash.slice(0, 16)}…
              </p>
            </div>
            {!consent.revokedAt && (
              <button
                type="button"
                onClick={() => onRevoke(consent)}
                className="text-xs text-status-red underline hover:no-underline"
              >
                Revocar
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
