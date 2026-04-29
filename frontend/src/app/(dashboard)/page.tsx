'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DASHBOARD_STATS_QUERY_KEY, fetchDashboardStats } from '@/lib/dashboard-stats';
import { useAuthStore } from '@/stores/auth-store';
import { canCreateEncounter as canCreateEncounterPermission, canCreatePatient as canCreatePatientPermission } from '@/lib/permissions';
import { type DashboardData } from './dashboard.constants';
import DashboardAdminView from './DashboardAdminView';
import DashboardClinicalView from './DashboardClinicalView';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const isOperationalAdmin = !!user?.isAdmin;
  const canNewEncounter = canCreateEncounterPermission(user);
  const canNewPatient = canCreatePatientPermission(user);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: DASHBOARD_STATS_QUERY_KEY,
    queryFn: fetchDashboardStats<DashboardData>,
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
