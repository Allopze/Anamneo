'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  FiPlus,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiFilter,
  FiUsers,
} from 'react-icons/fi';
import clsx from 'clsx';
import Tooltip from '@/components/common/Tooltip';
import { useAuthStore } from '@/stores/auth-store';

interface ContextChip {
  key: string;
  icon: React.ElementType;
  label: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  variant?: 'filter' | 'action';
}

function getContextChips(
  pathname: string,
  searchParams: URLSearchParams,
  canCreateEncounter: boolean,
  canCreatePatient: boolean,
): ContextChip[] {
  // Encounters page — status filter chips
  if (pathname === '/atenciones') {
    const currentStatus = searchParams.get('status') || '';
    return [
      {
        key: 'filter-all',
        icon: FiFilter,
        label: 'Todas las atenciones',
        href: '/atenciones',
        isActive: !currentStatus,
        variant: 'filter',
      },
      {
        key: 'filter-progress',
        icon: FiClock,
        label: 'En progreso',
        href: '/atenciones?status=EN_PROGRESO',
        isActive: currentStatus === 'EN_PROGRESO',
        variant: 'filter',
      },
      {
        key: 'filter-completed',
        icon: FiCheckCircle,
        label: 'Completadas',
        href: '/atenciones?status=COMPLETADO',
        isActive: currentStatus === 'COMPLETADO',
        variant: 'filter',
      },
      {
        key: 'filter-cancelled',
        icon: FiXCircle,
        label: 'Canceladas',
        href: '/atenciones?status=CANCELADO',
        isActive: currentStatus === 'CANCELADO',
        variant: 'filter',
      },
    ];
  }

  // Dashboard — quick action chips
  if (pathname === '/') {
    const chips: ContextChip[] = [];
    if (canCreateEncounter) {
      chips.push({
        key: 'new-encounter',
        icon: FiPlus,
        label: 'Nueva atención',
        href: '/atenciones/nueva',
        variant: 'action',
      });
    }
    if (canCreatePatient) {
      chips.push({
        key: 'new-patient',
        icon: FiUsers,
        label: 'Nuevo paciente',
        href: '/pacientes/nuevo',
        variant: 'action',
      });
    }
    return chips;
  }

  // Patients page
  if (pathname === '/pacientes') {
    const chips: ContextChip[] = [];
    if (canCreatePatient) {
      chips.push({
        key: 'new-patient',
        icon: FiPlus,
        label: 'Nuevo paciente',
        href: '/pacientes/nuevo',
        variant: 'action',
      });
    }
    return chips;
  }

  return [];
}

export default function HeaderContextBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canCreateEncounter, canCreatePatient } = useAuthStore();

  const chips = getContextChips(
    pathname,
    searchParams,
    canCreateEncounter(),
    canCreatePatient(),
  );

  if (chips.length === 0) return null;

  return (
    <div className="header-context-bar">
      <div className="flex items-center gap-1.5 flex-wrap">
        {chips.map((chip) => {
          const ChipIcon = chip.icon;
          const isFilter = chip.variant === 'filter';
          const isAction = chip.variant === 'action';

          const chipClass = clsx(
            'header-context-chip',
            isFilter && 'header-context-chip-filter',
            isAction && 'header-context-chip-action',
            chip.isActive && 'header-context-chip-active',
          );

          if (chip.href) {
            return (
              <Tooltip key={chip.key} label={chip.label} side="bottom">
                <Link
                  href={chip.href}
                  className={chipClass}
                  aria-label={chip.label}
                  aria-current={chip.isActive ? 'true' : undefined}
                >
                  <ChipIcon className="w-4 h-4" />
                </Link>
              </Tooltip>
            );
          }

          return (
            <Tooltip key={chip.key} label={chip.label} side="bottom">
              <button
                onClick={chip.onClick}
                className={chipClass}
                aria-label={chip.label}
                aria-pressed={chip.isActive || undefined}
              >
                <ChipIcon className="w-4 h-4" />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
