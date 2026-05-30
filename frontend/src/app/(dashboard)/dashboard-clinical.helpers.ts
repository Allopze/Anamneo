import { FiCalendar, FiClipboard, FiClock, FiFolder } from 'react-icons/fi';
import { STATUS_LABELS } from '@/types';
import type { DashboardData } from './dashboard.constants';

export interface PatientSummary {
  patientId: string;
  patientName: string;
  patientRut: string | null;
  updatedAt: string;
  latestEncounterId: string;
  latestEncounterStatus: string;
  encounterCount: number;
}

export function buildPatientMap(recentEncounters: DashboardData['recent']): Map<string, PatientSummary> {
  const map = new Map<string, PatientSummary>();

  for (const encounter of recentEncounters) {
    const existing = map.get(encounter.patientId);
    if (existing) {
      existing.encounterCount += 1;
      continue;
    }

    map.set(encounter.patientId, {
      patientId: encounter.patientId,
      patientName: encounter.patientName,
      patientRut: encounter.patientRut,
      updatedAt: encounter.updatedAt,
      latestEncounterId: encounter.id,
      latestEncounterStatus: STATUS_LABELS[encounter.status as keyof typeof STATUS_LABELS] ?? encounter.status,
      encounterCount: 1,
    });
  }

  return map;
}

export interface ReminderCard {
  label: string;
  value: number;
  href: string;
  tone: string;
  icon: typeof FiClock;
}

export function buildReminderCards(data: DashboardData): ReminderCard[] {
  return [
    {
      label: 'Vencidos',
      value: data.counts.overdueTasks,
      href: '/pacientes?taskWindow=OVERDUE',
      tone:
        data.counts.overdueTasks > 0
          ? 'border-status-red/35 bg-status-red/8 text-status-red-text'
          : 'border-surface-muted/30 bg-surface-elevated text-ink',
      icon: FiClock,
    },
    {
      label: 'Vencen hoy',
      value: data.counts.dueTodayTasks,
      href: '/pacientes?taskWindow=TODAY',
      tone:
        data.counts.dueTodayTasks > 0
          ? 'border-status-yellow/45 bg-status-yellow/16 text-accent-text'
          : 'border-surface-muted/30 bg-surface-elevated text-ink',
      icon: FiClipboard,
    },
    {
      label: 'Esta semana',
      value: data.counts.dueThisWeekTasks,
      href: '/pacientes?taskWindow=THIS_WEEK',
      tone: 'border-surface-muted/30 bg-surface-elevated text-ink',
      icon: FiCalendar,
    },
    {
      label: 'Trámites próximos',
      value: data.counts.upcomingAdministrativeTasks,
      href: '/seguimientos?type=TRAMITE',
      tone: 'border-surface-muted/30 bg-surface-elevated text-ink',
      icon: FiFolder,
    },
  ];
}
