'use client';

import Link from 'next/link';

type Props = {
  identificationMissingFields: string[];
  patientCompletenessMeta: { label: string; description: string } | null;
  patientCompletenessStatus?: string | null;
  clinicalOutputBlockReason?: string | null;
  patientId: string;
};

export default function EncounterClinicalWarnings({
  identificationMissingFields,
  patientCompletenessMeta,
  patientCompletenessStatus,
  clinicalOutputBlockReason,
  patientId,
}: Props) {
  const showWarnings = identificationMissingFields.length > 0
    || Boolean(patientCompletenessStatus && patientCompletenessStatus !== 'VERIFICADA')
    || Boolean(clinicalOutputBlockReason);

  if (!showWarnings) {
    return null;
  }

  const hasCompletenessWarning = Boolean(
    patientCompletenessMeta && patientCompletenessStatus && patientCompletenessStatus !== 'VERIFICADA',
  );

  return (
    <div className="px-4 pt-4 lg:px-8 xl:px-10">
      <div className="rounded-card border border-surface-muted/40 bg-surface-base p-4 text-sm text-ink-secondary">
        {identificationMissingFields.length > 0 ? (
          <p>La identificación de esta atención sigue incompleta. Faltan: {identificationMissingFields.join(', ')}.</p>
        ) : null}
        {hasCompletenessWarning ? (
          <p className={identificationMissingFields.length > 0 ? 'mt-2' : ''}>
            La ficha del paciente está en estado &ldquo;{patientCompletenessMeta?.label.toLowerCase()}&rdquo;.
          </p>
        ) : null}
        {clinicalOutputBlockReason ? (
          <>
            <p
              className={
                identificationMissingFields.length > 0 || hasCompletenessWarning
                  ? 'mt-2'
                  : ''
              }
            >
              {clinicalOutputBlockReason}
            </p>
            <Link
              href={`/pacientes/${patientId}`}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-surface-muted px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-muted/50 hover:text-ink"
            >
              Revisar ficha administrativa
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
