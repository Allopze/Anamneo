'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FiClock } from 'react-icons/fi';
import clsx from 'clsx';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  reason: string | null;
  label: string;
  userName: string;
  sectionKey: string | null;
  sectionLabel: string | null;
}

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default function EncounterAuditTimeline({ encounterId }: { encounterId: string }) {
  const { data: entries, isLoading, error } = useQuery({
    queryKey: ['encounter-audit', encounterId],
    queryFn: async () => {
      const res = await api.get<AuditEntry[]>(`/encounters/${encounterId}/audit`);
      return res.data;
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-5 py-4 text-xs text-ink-secondary">
        <FiClock className="h-3.5 w-3.5 animate-pulse" />
        Cargando historial…
      </div>
    );
  }

  if (error || !entries) {
    return (
      <p className="px-5 py-4 text-xs text-ink-secondary">
        No se pudo cargar el historial.
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="px-5 py-4 text-xs text-ink-secondary">
        Sin eventos registrados.
      </p>
    );
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 pb-3 text-sm font-semibold text-ink">
        <FiClock className="h-4 w-4 text-ink-secondary" />
        Historial de Cambios
      </div>
      <ol className="relative border-l border-surface-muted/60 pl-4">
        {entries.map((entry, idx) => (
          <li key={entry.id} className={clsx('relative pb-4', idx === entries.length - 1 && 'pb-0')}>
            <span className="absolute -left-[calc(1rem+3.5px)] top-1.5 h-[7px] w-[7px] rounded-full border border-frame/30 bg-surface-elevated" />
            <p className="text-xs font-medium text-ink">{entry.label}</p>
            {entry.sectionLabel && (
              <p className="text-[11px] text-ink-secondary">{entry.sectionLabel}</p>
            )}
            <p className="mt-0.5 text-[11px] text-ink-secondary">
              {entry.userName} · {dateFormatter.format(new Date(entry.timestamp))}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
