'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { type DashboardData } from './dashboard.constants';
import DashboardAdminView from './DashboardAdminView';
import DashboardClinicalView from './DashboardClinicalView';

export default function DashboardPage() {
  const { user, canCreateEncounter, canCreatePatient } = useAuthStore();
  const isOperationalAdmin = !!user?.isAdmin;
  const canNewEncounter = canCreateEncounter();
  const canNewPatient = canCreatePatient();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/encounters/stats/dashboard');
      return res.data;
    },
    enabled: !isOperationalAdmin,
  });

  const [overdueAlertDismissed, setOverdueAlertDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('anamneo:overdue-alert-dismissed') === '1';
  });

  const overdueCount = data?.counts.overdueTasks ?? 0;
  const overdueTasks = data?.upcomingTasks.filter((t) => t.isOverdue) ?? [];
  const showOverdueAlert = overdueCount > 0 && !overdueAlertDismissed;

  function dismissOverdueAlert() {
    setOverdueAlertDismissed(true);
    sessionStorage.setItem('anamneo:overdue-alert-dismissed', '1');
  }

  if (isOperationalAdmin) {
    return <DashboardAdminView user={user} />;
  }

  return (
    <DashboardClinicalView
      user={user}
      data={data}
      isLoading={isLoading}
      canNewEncounter={canNewEncounter}
      canNewPatient={canNewPatient}
      showOverdueAlert={showOverdueAlert}
      overdueCount={overdueCount}
      overdueTasks={overdueTasks}
      onDismissOverdueAlert={dismissOverdueAlert}
    />
  );
}
