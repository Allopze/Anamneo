'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FiAlertOctagon } from 'react-icons/fi';

type Allergy = { id: string; allergen: string; severity: string };

function AllergyBanner({ patientId }: { patientId: string }) {
  const { data: allergies } = useQuery({
    queryKey: ['patient-allergies', patientId],
    queryFn: async () => (await api.get<Allergy[]>(`/allergies/patient/${patientId}`)).data,
    staleTime: 60_000,
  });

  const severe = (allergies ?? []).filter(
    (a) => a.severity === 'GRAVE' || a.severity === 'FATAL',
  );
  if (severe.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-card border border-status-red/40 bg-status-red/10 px-4 py-3 text-sm text-status-red" role="alert">
      <FiAlertOctagon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <strong>Alerta de alergias:</strong>{' '}
        {severe.map((a) => `${a.allergen} (${a.severity.toLowerCase()})`).join(', ')}.{' '}
        Verifique antes de prescribir.
      </p>
    </div>
  );
}

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

  return (
    <div className="space-y-2 px-4 pt-4 lg:px-8 xl:px-10">
      <AllergyBanner patientId={patientId} />
      {showWarnings && (
        <div className="rounded-card border border-surface-muted/40 bg-surface-base p-4 text-sm text-ink-secondary">
          {identificationMissingFields.length > 0 ? (
            <p>La identificación de esta atención sigue incompleta. Faltan: {identificationMissingFields.join(', ')}.</p>
          ) : null}
          {Boolean(patientCompletenessMeta && patientCompletenessStatus && patientCompletenessStatus !== 'VERIFICADA') ? (
            <p className={identificationMissingFields.length > 0 ? 'mt-2' : ''}>
              La ficha del paciente está en estado &ldquo;{patientCompletenessMeta?.label.toLowerCase()}&rdquo;.
            </p>
          ) : null}
          {clinicalOutputBlockReason ? (
            <>
              <p className={identificationMissingFields.length > 0 || (patientCompletenessMeta && patientCompletenessStatus !== 'VERIFICADA') ? 'mt-2' : ''}>
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
      )}
    </div>
  );
}
