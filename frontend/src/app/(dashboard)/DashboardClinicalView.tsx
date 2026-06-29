'use client';

import { useMemo, useState, useEffect } from 'react';
import { type DashboardData } from './dashboard.constants';
import DashboardClinicalHero from './DashboardClinicalHero';
import OverdueAlertSection from './OverdueAlertSection';
import RecentActivitySection from './RecentActivitySection';
import RecentPatientsSection from './RecentPatientsSection';
import OnboardingPanel from '@/components/onboarding/OnboardingPanel';
import OnboardingWelcomeModal from '@/components/onboarding/OnboardingWelcomeModal';
import { useOnboarding } from '@/lib/onboarding';
import { buildPatientMap, buildReminderCards } from './dashboard-clinical.helpers';
import {
  ActiveEncountersPanel,
  UpcomingTasksPanel,
  ReminderCardsPanel,
} from './dashboard-clinical.parts';

interface DashboardClinicalViewProps {
  user: { nombre?: string } | null;
  data?: DashboardData;
  isLoading: boolean;
  canNewEncounter: boolean;
  canNewPatient: boolean;
  showOverdueAlert: boolean;
  overdueCount: number;
  overdueTasks: DashboardData['upcomingTasks'];
  onDismissOverdueAlert: () => void;
}

const WELCOME_MODAL_SEEN_KEY = 'anamneo:onboarding-welcome-seen';

export default function DashboardClinicalView({
  user,
  data,
  isLoading,
  canNewEncounter,
  canNewPatient,
  showOverdueAlert,
  overdueCount,
  overdueTasks,
  onDismissOverdueAlert,
}: DashboardClinicalViewProps) {
  const { eligible, progress } = useOnboarding();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    if (!eligible || !progress) return;
    const alreadySeen = typeof window !== 'undefined' && localStorage.getItem(WELCOME_MODAL_SEEN_KEY) === '1';
    if (alreadySeen) return;
    const isFirstVisit =
      progress.eligible && !progress.dismissedAt && !progress.isComplete && progress.completedStepIds.length === 0;
    if (isFirstVisit) setShowWelcomeModal(true);
  }, [eligible, progress]);

  const handleCloseWelcomeModal = () => {
    if (typeof window !== 'undefined') localStorage.setItem(WELCOME_MODAL_SEEN_KEY, '1');
    setShowWelcomeModal(false);
  };

  const recentEncounters = useMemo(() => data?.recent ?? [], [data?.recent]);
  const activeEncounters = useMemo(() => data?.activeEncounters ?? [], [data?.activeEncounters]);
  const recentPatients = useMemo(
    () => Array.from(buildPatientMap(recentEncounters).values()).slice(0, 5),
    [recentEncounters],
  );
  const upcomingTasks = data?.upcomingTasks ?? [];
  const reminderCards = useMemo(() => (data ? buildReminderCards(data) : []), [data]);

  return (
    <div className="space-y-4 pb-2">
      {showWelcomeModal && <OnboardingWelcomeModal onClose={handleCloseWelcomeModal} />}

      <DashboardClinicalHero
        user={user}
        data={data}
        isLoading={isLoading}
        canNewEncounter={canNewEncounter}
        canNewPatient={canNewPatient}
        recentPatientsCount={recentPatients.length}
      />

      <OnboardingPanel />

      {showOverdueAlert && (
        <OverdueAlertSection
          overdueCount={overdueCount}
          overdueTasks={overdueTasks}
          onDismiss={onDismissOverdueAlert}
        />
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)]">
        <ActiveEncountersPanel
          isLoading={isLoading}
          activeEncounters={activeEncounters}
          canNewEncounter={canNewEncounter}
        />

        <div className="space-y-4">
          <UpcomingTasksPanel isLoading={isLoading} upcomingTasks={upcomingTasks} />
          <RecentPatientsSection patients={recentPatients} isLoading={isLoading} />
          <ReminderCardsPanel isLoading={isLoading} reminderCards={reminderCards} />
        </div>

        <RecentActivitySection encounters={recentEncounters} isLoading={isLoading} />
      </div>
    </div>
  );
}
