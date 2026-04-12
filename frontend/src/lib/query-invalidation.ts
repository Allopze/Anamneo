import type { QueryClient } from '@tanstack/react-query';

const DASHBOARD_QUERY_KEYS = [
  ['dashboard'],
  ['dashboard-header-kpis'],
  ['encounters-operational-summary'],
  ['patients'],
] as const;

const ALERT_OVERVIEW_QUERY_KEYS = [
  ['alerts-unacknowledged-count'],
  ['alerts-unacknowledged-list'],
] as const;

const TASK_OVERVIEW_QUERY_KEYS = [
  ['task-inbox'],
] as const;

async function invalidateMany(queryClient: QueryClient, queryKeys: readonly (readonly string[])[]) {
  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })));
}

export async function invalidateDashboardOverviewQueries(queryClient: QueryClient) {
  await invalidateMany(queryClient, DASHBOARD_QUERY_KEYS);
}

export async function invalidateAlertOverviewQueries(queryClient: QueryClient) {
  await invalidateMany(queryClient, ALERT_OVERVIEW_QUERY_KEYS);
}

export async function invalidateTaskOverviewQueries(queryClient: QueryClient) {
  await invalidateMany(queryClient, TASK_OVERVIEW_QUERY_KEYS);
}

export async function invalidateOperationalQueries(queryClient: QueryClient) {
  await Promise.all([
    invalidateDashboardOverviewQueries(queryClient),
    invalidateAlertOverviewQueries(queryClient),
    invalidateTaskOverviewQueries(queryClient),
  ]);
}
