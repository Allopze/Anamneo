'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import {
  FiClock,
  FiAlertTriangle,
  FiClipboard,
  FiCheckCircle,
} from 'react-icons/fi';
import clsx from 'clsx';
import Tooltip from '@/components/common/Tooltip';

interface DashboardCounts {
  enProgreso: number;
  completado: number;
  cancelado: number;
  total: number;
  pendingReview: number;
  upcomingTasks: number;
}

interface KpiDefinition {
  key: string;
  label: string;
  unit: string;
  icon: React.ElementType;
  tone: string;
  getValue: (counts: DashboardCounts) => number;
}

const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    key: 'en-progreso',
    label: 'Atenciones activas',
    unit: 'en curso',
    icon: FiClock,
    tone: 'text-accent-text',
    getValue: (c) => c.enProgreso,
  },
  {
    key: 'pendientes',
    label: 'Pendientes de revisión',
    unit: 'pendientes',
    icon: FiAlertTriangle,
    tone: 'text-status-red-text',
    getValue: (c) => c.pendingReview,
  },
  {
    key: 'seguimientos',
    label: 'Seguimientos activos',
    unit: 'activos',
    icon: FiClipboard,
    tone: 'text-accent-text',
    getValue: (c) => c.upcomingTasks,
  },
  {
    key: 'completadas',
    label: 'Completadas',
    unit: 'cerradas',
    icon: FiCheckCircle,
    tone: 'text-status-green-text',
    getValue: (c) => c.completado,
  },
];

/** Maps pathname to a human-readable context title */
function getModuleTitle(pathname: string): string {
  if (pathname === '/') return 'Inicio';
  if (pathname.startsWith('/pacientes')) return 'Pacientes';
  if (pathname.startsWith('/atenciones')) return 'Atenciones';
  if (pathname.startsWith('/seguimientos')) return 'Seguimientos';
  if (pathname.startsWith('/catalogo')) return 'Catálogo';
  if (pathname.startsWith('/plantillas')) return 'Plantillas';
  if (pathname.startsWith('/ajustes')) return 'Ajustes';
  if (pathname.startsWith('/admin/auditoria')) return 'Auditoría';
  if (pathname.startsWith('/admin')) return 'Administración';
  return 'Anamneo';
}

export default function HeaderKpiBar() {
  const pathname = usePathname();
  const moduleTitle = getModuleTitle(pathname);

  const { data, isLoading, isError } = useQuery<{ counts: DashboardCounts }>({
    queryKey: ['dashboard-header-kpis'],
    queryFn: async () => {
      const res = await api.get('/encounters/stats/dashboard');
      return res.data;
    },
    staleTime: 60_000,       // 1 min — avoid hammering on every route change
    refetchInterval: 120_000, // 2 min refresh in background
    retry: 2,
  });

  const counts = data?.counts;
  const showSkeleton = isLoading && !counts;

  return (
    <div className="header-kpi-bar">
      {/* Left: Module context — use h2, each page has its own h1 */}
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="header-module-title">{moduleTitle}</h2>
      </div>

      {/* Right: KPI grid */}
      <div className="header-kpi-grid">
        {KPI_DEFINITIONS.map((kpi) => {
          const value = counts != null ? kpi.getValue(counts) : undefined;
          const KpiIcon = kpi.icon;

          return (
            <Tooltip key={kpi.key} label={kpi.label} side="bottom">
              <div className="header-kpi-item" aria-label={kpi.label}>
                <div className={clsx('header-kpi-icon', kpi.tone)}>
                  <KpiIcon className="w-3.5 h-3.5" />
                </div>
                <div className="header-kpi-content">
                  {showSkeleton ? (
                    <div className="h-6 w-8 skeleton rounded-lg" />
                  ) : isError || value === undefined ? (
                    <span className="header-kpi-value text-ink-muted">—</span>
                  ) : (
                    <span className="header-kpi-value">{value}</span>
                  )}
                  <span className="header-kpi-unit">{kpi.unit}</span>
                </div>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
