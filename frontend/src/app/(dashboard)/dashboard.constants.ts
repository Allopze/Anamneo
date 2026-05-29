import type { ComponentType } from 'react';
import {
  FiClipboard,
  FiFileText,
  FiSettings,
  FiUsers,
} from 'react-icons/fi';
import { ShieldIcon, ActivityIcon } from '@/components/icons';
import { PatientTask } from '@/types';

export type DashboardEncounterSummary = {
  id: string;
  patientId: string;
  patientName: string;
  patientRut: string | null;
  createdByName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  progress: { completed: number; total: number };
};

export interface DashboardData {
  counts: {
    enProgreso: number;
    completado: number;
    cancelado: number;
    total: number;
    pendingReview: number;
    upcomingTasks: number;
    overdueTasks: number;
    dueTodayTasks: number;
    dueThisWeekTasks: number;
    upcomingAdministrativeTasks: number;
    patientIncomplete: number;
    patientPendingVerification: number;
    patientVerified: number;
    patientNonVerified: number;
  };
  recent: DashboardEncounterSummary[];
  activeEncounters: DashboardEncounterSummary[];
  upcomingTasks: PatientTask[];
}

export const sectionAnimation = (delay: number) => ({
  animationDelay: `${delay}ms`,
  animationFillMode: 'both' as const,
});

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export type AdminCard = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

export type AdminCardSection = {
  heading: string;
  cards: AdminCard[];
};

/** Admin module cards grouped by frequency and risk. */
export const ADMIN_CARD_SECTIONS: AdminCardSection[] = [
  {
    heading: 'Operación diaria',
    cards: [
      {
        href: '/admin/usuarios',
        label: 'Gestión de usuarios',
        description: 'Invitar, editar roles y recuperar accesos.',
        icon: FiUsers,
      },
      {
        href: '/pacientes',
        label: 'Padrón de pacientes',
        description: 'Consultar el registro administrativo y exportar CSV.',
        icon: FiClipboard,
      },
      {
        href: '/catalogo',
        label: 'Catálogo clínico',
        description: 'Mantener diagnósticos y sinónimos globales.',
        icon: FiFileText,
      },
    ],
  },
  {
    heading: 'Gobernanza y configuración',
    cards: [
      {
        href: '/ajustes',
        label: 'Ajustes del sistema',
        description: 'Configurar correo, plantillas e identidad del centro.',
        icon: FiSettings,
      },
      {
        href: '/admin/auditoria',
        label: 'Auditoría',
        description: 'Revisar trazabilidad y exportes del sistema.',
        icon: ActivityIcon,
      },
      {
        href: '/admin/solicitudes',
        label: 'Solicitudes de derechos',
        description: 'Gestionar derechos de titulares según Ley 21.719.',
        icon: ShieldIcon,
      },
    ],
  },
];

/** @deprecated Use ADMIN_CARD_SECTIONS instead. */
export const ADMIN_CARDS = ADMIN_CARD_SECTIONS.flatMap((s) => s.cards);
