'use client';

import { FiUser, FiAlertCircle } from 'react-icons/fi';
import clsx from 'clsx';

interface PatientContextBarProps {
  nombre: string;
  rut?: string | null;
  edad?: number | string | null;
  edadMeses?: number | null;
  sexo?: string | null;
  prevision?: string | null;
  completenessStatus?: string | null;
  alertCount?: number;
}

export default function PatientContextBar({
  nombre,
  rut,
  edad,
  edadMeses,
  sexo,
  prevision,
  completenessStatus,
  alertCount,
}: PatientContextBarProps) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-surface-muted/30 bg-surface-elevated/80 px-4 py-2.5 text-sm shadow-soft">
      <FiUser className="h-4 w-4 shrink-0 text-ink-secondary" />
      <span className="font-semibold text-ink truncate">{nombre}</span>
      {rut && <span className="text-ink-secondary">{rut}</span>}
      {edad != null && (
        <span className="text-ink-secondary">
          {edad} años{edadMeses ? ` ${edadMeses}m` : ''}
        </span>
      )}
      {sexo && <span className="text-ink-secondary">{sexo}</span>}
      {prevision && <span className="text-ink-secondary">{prevision}</span>}
      {completenessStatus && completenessStatus !== 'VERIFICADA' && (
        <span className="inline-flex items-center gap-1 text-xs text-status-yellow-text">
          <FiAlertCircle className="h-3.5 w-3.5" />
          Ficha incompleta
        </span>
      )}
      {alertCount != null && alertCount > 0 && (
        <span className={clsx(
          'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
          'border border-status-red/30 bg-status-red/10 text-status-red-text',
        )}>
          <FiAlertCircle className="h-3 w-3" />
          {alertCount} alerta{alertCount > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
