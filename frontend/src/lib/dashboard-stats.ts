import { api } from '@/lib/api';

export const DASHBOARD_STATS_QUERY_KEY = ['encounters', 'stats', 'dashboard'] as const;

export async function fetchDashboardStats<T>() {
  const response = await api.get('/encounters/stats/dashboard');
  return response.data as T;
}
