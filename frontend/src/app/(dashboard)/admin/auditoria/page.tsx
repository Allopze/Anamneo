'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, getErrorMessage, PaginatedResponse } from '@/lib/api';
import { useAuthIsAdmin } from '@/stores/auth-store';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { type AdminUserRow, type AuditLogEntry } from './auditoria.constants';
import AuditDetailModal from './AuditDetailModal';
import AuditIntegrityCard from './AuditIntegrityCard';
import { AuditFiltersPanel, AuditLogTable } from './auditoria.parts';

export default function AuditoriaPage() {
  const router = useRouter();
  const isAdmin = useAuthIsAdmin();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    userId: '',
    reason: '',
    result: '',
    requestId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    if (!isAdmin) router.push('/pacientes');
  }, [isAdmin, router]);

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get('/users')).data as AdminUserRow[],
    enabled: isAdmin,
  });

  const usersMap = new Map((users || []).map((u) => [u.id, u]));

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      return (await api.get(`/audit?${params.toString()}`)).data as PaginatedResponse<AuditLogEntry>;
    },
    enabled: isAdmin,
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  if (!isAdmin) return null;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Auditoría</h1>
          <p className="page-header-description">Historial de cambios críticos y trazabilidad operativa del sistema.</p>
        </div>
      </div>

      <AuditIntegrityCard />

      <AuditFiltersPanel
        filters={filters}
        users={users}
        setPage={setPage}
        setFilters={setFilters}
      />

      {error && (
        <div className="mb-6">
          <ErrorAlert message={getErrorMessage(error)} />
        </div>
      )}

      <AuditLogTable
        logs={logs}
        isLoading={isLoading}
        usersMap={usersMap}
        page={page}
        pagination={pagination}
        onSelectLog={setSelectedLog}
        onPageChange={(delta) => setPage((p) => p + delta)}
      />

      {selectedLog && (
        <AuditDetailModal
          log={selectedLog}
          usersMap={usersMap}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
