'use client';

/**
 * Sub-components for analitica-clinica/page.tsx.
 */

import React from 'react';

export function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric-card flex items-start gap-3">
      <div className="rounded-full bg-surface-inset p-3 text-ink-secondary">{icon}</div>
      <div>
        <p className="text-sm font-bold text-ink-muted">{title}</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{value}</p>
        <p className="mt-2 text-sm text-ink-secondary">{detail}</p>
      </div>
    </div>
  );
}
