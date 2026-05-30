import {
  FiActivity,
  FiCalendar,
  FiHome,
  FiUsers,
  FiClipboard,
  FiList,
  FiPieChart,
  FiSettings,
  FiBookmark,
} from 'react-icons/fi';
import { FichaIcon } from '@/components/icons';
import type { NavItem } from './DashboardSidebar';

export const primaryNavigation: NavItem[] = [
  { name: 'Inicio', href: '/', icon: FiHome, exact: true },
  { name: 'Pacientes', href: '/pacientes', icon: FiUsers },
  { name: 'Agenda', href: '/agenda', icon: FiCalendar },
  { name: 'Atenciones', href: '/atenciones', icon: FichaIcon },
  { name: 'Seguimientos', href: '/seguimientos', icon: FiClipboard },
  { name: 'Reportes', href: '/reportes', icon: FiPieChart },
];

export const clinicalAnalyticsNavigation: NavItem = {
  name: 'Analítica clínica',
  href: '/analitica-clinica',
  icon: FiActivity,
};

export const secondaryNavigation: NavItem[] = [
  { name: 'Catálogo', href: '/catalogo', icon: FiList },
  { name: 'Plantillas', href: '/plantillas', icon: FiBookmark },
  { name: 'Ajustes', href: '/ajustes', icon: FiSettings },
];
