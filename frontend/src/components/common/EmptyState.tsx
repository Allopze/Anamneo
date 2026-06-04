import type { ReactNode } from 'react';
import { FiInbox } from 'react-icons/fi';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon = <FiInbox className="h-6 w-6" aria-hidden="true" />,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`rounded-card border border-surface-muted/45 bg-surface-elevated/75 px-5 py-8 text-center shadow-none ${className}`}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-card border border-surface-muted/55 bg-surface-inset/75 text-ink-muted">
        <div className="flex h-9 w-9 items-center justify-center rounded-btn bg-surface-elevated">
          {icon}
        </div>
      </div>
      <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-secondary">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
