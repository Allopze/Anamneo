import Link from 'next/link';
import clsx from 'clsx';
import { FiShield } from 'react-icons/fi';
import type { PatientLegalStatus } from '@/types';

export default function PatientLegalStatusSummary({ legalStatus }: { legalStatus?: PatientLegalStatus }) {
  if (!legalStatus) return null;

  return (
    <section className="card">
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            'rounded-full p-2',
            legalStatus.canReceiveCare
              ? 'bg-status-green/15 text-status-green-text'
              : 'bg-status-red/15 text-status-red-text',
          )}
        >
          <FiShield className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-bold text-ink">Estado legal del paciente</p>
          <p className="mt-1 text-sm text-ink-secondary">
            {legalStatus.canReceiveCare
              ? 'Habilitado para atención y mutaciones clínicas.'
              : legalStatus.legalBlockReason ?? 'Tratamiento de datos bloqueado temporalmente.'}
          </p>
          <dl className="mt-3 grid gap-2 text-sm text-ink-secondary sm:grid-cols-2">
            <div>
              <dt className="font-medium text-ink">Consentimiento datos</dt>
              <dd>
                {legalStatus.hasActiveDataProcessingConsent === null
                  ? 'No evaluado'
                  : legalStatus.hasActiveDataProcessingConsent
                    ? `Vigente para atención${legalStatus.dataProcessingConsent?.legalDocumentVersion ? ` v${legalStatus.dataProcessingConsent.legalDocumentVersion}` : ''}`
                    : 'Pendiente'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Solicitudes activas</dt>
              <dd>{legalStatus.activeDataRequestCount}</dd>
            </div>
          </dl>
          {legalStatus.dataProcessingConsent?.evidenceHash ? (
            <p className="mt-2 text-xs text-ink-secondary">
              Evidencia: <code className="break-all">{legalStatus.dataProcessingConsent.evidenceHash.slice(0, 16)}</code>
            </p>
          ) : null}
          {legalStatus.activeDataRequests.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-ink-secondary">
              {legalStatus.activeDataRequests.map((request) => (
                <li key={request.id} className="flex flex-wrap gap-x-2">
                  <Link className="font-medium text-brand-teal hover:underline" href="/admin/solicitudes">
                    {request.requestType}
                  </Link>
                  <span>{request.status}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {legalStatus.requiredActions.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-ink-secondary">
              {legalStatus.requiredActions.map((action) => (
                <li key={action.code} className="flex gap-2">
                  <span aria-hidden="true">-</span>
                  <span>{action.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
