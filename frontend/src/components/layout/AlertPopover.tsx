'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { FiBell, FiArrowRight } from 'react-icons/fi';
import clsx from 'clsx';
import Tooltip from '@/components/common/Tooltip';
import type { AlertSummary } from './smart-header-bar.config';
import { SEVERITY_STYLE, SEVERITY_LABEL } from './smart-header-bar.config';

interface AlertPopoverProps {
  isNonClinical: boolean;
}

export default function AlertPopover({ isNonClinical }: AlertPopoverProps) {
  const [alertOpen, setAlertOpen] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const alertItemsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent, itemsRef: React.MutableRefObject<(HTMLAnchorElement | null)[]>) => {
      const items = itemsRef.current.filter(Boolean) as HTMLAnchorElement[];
      if (!items.length) return;
      const idx = items.indexOf(e.target as HTMLAnchorElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
      }
    },
    [],
  );

  const { data: alertData, isError: isAlertError, refetch: refetchAlertCount } = useQuery<{ count: number }>({
    queryKey: ['alerts-unacknowledged-count'],
    queryFn: async () => {
      const res = await api.get('/alerts/unacknowledged-count');
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 2,
    enabled: !isNonClinical,
  });

  const {
    data: alertListData,
    isLoading: isAlertListLoading,
    isError: isAlertListError,
    refetch: refetchAlertList,
  } = useQuery<{ data: AlertSummary[] }>({
    queryKey: ['alerts-unacknowledged-list'],
    queryFn: async () => {
      const res = await api.get('/alerts/unacknowledged');
      return res.data;
    },
    staleTime: 60_000,
    retry: 2,
    enabled: alertOpen,
  });

  // Close on outside click or Escape
  // NOTE: The parent SmartHeaderBar also handles Escape for its own dropdowns,
  // but this component manages its own alertOpen state independently.
  const hasAlertPopoverError = isAlertError || isAlertListError;
  const alertCount = isAlertError ? null : (alertData?.count ?? 0);
  const alertLabel = alertCount === null
    ? 'Error al cargar alertas'
    : alertCount > 0
      ? `${alertCount} alertas sin reconocer`
      : 'Sin alertas pendientes';

  const handleRetry = () => {
    void refetchAlertCount();
    void refetchAlertList();
  };

  return (
    <div ref={alertRef} className="relative">
      <Tooltip label={alertLabel} side="bottom">
        <button
          type="button"
          className="smart-header-action-btn relative"
          aria-label={alertLabel}
          aria-expanded={alertOpen}
          aria-haspopup="true"
          onClick={() => setAlertOpen(!alertOpen)}
        >
          <FiBell className={clsx('w-4 h-4', isAlertError && 'text-ink-muted')} />
          {alertCount !== null && alertCount > 0 && (
            <span className="smart-header-alert-badge">{alertCount > 99 ? '99+' : alertCount}</span>
          )}
        </button>
      </Tooltip>

      {alertOpen && (
        <div
          className="smart-header-alert-popover"
          role="region"
          aria-label="Alertas sin reconocer"
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.06]">
            <span className="text-sm font-bold text-ink">Alertas</span>
            {alertCount !== null && alertCount > 0 && (
              <span className="text-xs font-medium text-ink-muted">{alertCount} pendientes</span>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {isAlertListLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 skeleton rounded-card" />
                ))}
              </div>
            ) : hasAlertPopoverError ? (
              <div className="p-4 text-sm text-ink-muted text-center space-y-3">
                <p>Error al cargar alertas</p>
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={handleRetry}
                >
                  Reintentar
                </button>
              </div>
            ) : !alertListData?.data?.length ? (
              <div className="p-4 text-sm text-ink-muted text-center">Sin alertas pendientes</div>
            ) : (
              <div
                className="py-1"
                onKeyDown={(e) => handleMenuKeyDown(e, alertItemsRef)}
              >
                {alertListData.data.map((alert, i) => (
                  <Link
                    key={alert.id}
                    ref={(el) => { alertItemsRef.current[i] = el; }}
                    href={`/pacientes/${alert.patient.id}`}
                    className="smart-header-alert-item"
                    tabIndex={0}
                    onClick={() => setAlertOpen(false)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={clsx(
                        'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                        SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.MEDIA,
                      )}>
                        {SEVERITY_LABEL[alert.severity] || alert.severity}
                      </span>
                      <span className="truncate text-sm font-medium text-ink">{alert.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-ink-muted truncate">{alert.patient.nombre}</span>
                      <FiArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
