import {
  FiActivity,
  FiClipboard,
  FiFileText,
  FiSettings,
  FiUsers,
} from 'react-icons/fi';
import { PatientTask } from '@/types';

export interface DashboardData {
  counts: {
    enProgreso: number;
    completado: number;
    cancelado: number;
    total: number;
    pendingReview: number;
    upcomingTasks: number;
    overdueTasks: number;
    patientIncomplete: number;
    patientPendingVerification: number;
    patientVerified: number;
    patientNonVerified: number;
  };
  recent: Array<{
    id: string;
    patientId: string;
    patientName: string;
    patientRut: string | null;
    createdByName: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    progress: { completed: number; total: number };
  }>;
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

export const ADMIN_CARDS = [
  {
    href: '/admin/usuarios',
    label: 'Gestión de usuarios',
    description: 'Invitar, editar roles y recuperar accesos.',
    icon: FiUsers,
  },
  {
    href: '/admin/auditoria',
    label: 'Auditoría',
    description: 'Revisar trazabilidad y exportes del sistema.',
    icon: FiActivity,
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
  {
    href: '/ajustes',
    label: 'Ajustes del sistema',
    description: 'Configurar correo, plantillas e identidad del centro.',
    icon: FiSettings,
  },
];
