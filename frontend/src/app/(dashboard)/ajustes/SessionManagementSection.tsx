'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type SessionSummary = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  createdAt: string;
  isCurrent: boolean;
};

function formatSessionTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible';
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function describeDevice(userAgent: string | null) {
  if (!userAgent) {
    return 'Dispositivo sin identificar';
  }

  return userAgent;
}

export default function SessionManagementSection() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const sessionsQueryKey = ['auth', 'sessions', user?.id ?? 'anonymous'] as const;

  const sessionsQuery = useQuery({
    queryKey: sessionsQueryKey,
    queryFn: async () => (await api.get('/auth/sessions')).data as SessionSummary[],
    enabled: !!user?.id,
  });

  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/auth/sessions/${sessionId}`);
      return sessionId;
    },
    onSuccess: async () => {
      toast.success('Sesión remota cerrada');
      await queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const revokeOtherSessionsMutation = useMutation({
    mutationFn: async () => (await api.delete('/auth/sessions/others')).data as { revokedCount: number },
    onSuccess: async (data) => {
      toast.success(
        data.revokedCount > 0
          ? `Se cerraron ${data.revokedCount} sesión${data.revokedCount === 1 ? '' : 'es'}`
          : 'No había otras sesiones activas',
      );
      await queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const sessions = sessionsQuery.data ?? [];
  const remoteSessionCount = sessions.filter((session) => !session.isCurrent).length;

  return (
    <div className="card mb-6">
      <div className="panel-header flex items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">Sesiones activas</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Revisa dispositivos activos y cierra las sesiones remotas sin tocar la actual.
          </p>
        </div>
        {remoteSessionCount > 0 ? (
          <button
            type="button"
            className="btn btn-secondary shrink-0"
            disabled={revokeOtherSessionsMutation.isPending}
            onClick={() => revokeOtherSessionsMutation.mutate()}
          >
            {revokeOtherSessionsMutation.isPending ? 'Cerrando otras...' : 'Cerrar otras sesiones'}
          </button>
        ) : null}
      </div>

      {sessionsQuery.isLoading && (
        <div className="space-y-3" aria-live="polite">
          <div className="h-20 skeleton rounded-card" />
          <div className="h-20 skeleton rounded-card" />
        </div>
      )}

      {sessionsQuery.isError && (
        <div className="rounded-card border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red-text">
          {getErrorMessage(sessionsQuery.error)}
        </div>
      )}

      {sessions.length === 0 && (
        <div className="rounded-card border border-surface-muted/40 bg-surface-elevated/40 px-4 py-3 text-sm text-ink-secondary">
          No hay sesiones activas registradas para esta cuenta.
        </div>
      )}

      {sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session) => {
            const isRevokingThisSession =
              revokeMutation.isPending && revokeMutation.variables === session.id;

            return (
              <div
                key={session.id}
                className="rounded-card border border-surface-muted/40 bg-surface-elevated/50 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink break-words">
                        {describeDevice(session.userAgent)}
                      </p>
                      {session.isCurrent ? (
                        <span className="inline-flex items-center rounded-full bg-status-green/20 px-2.5 py-1 text-xs font-semibold text-status-green-text">
                          Sesión actual
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
                          Sesión remota
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-ink-secondary">
                      <p>IP: {session.ipAddress || 'No registrada'}</p>
                      <p>Iniciada: {formatSessionTimestamp(session.createdAt)}</p>
                      <p>Última actividad: {formatSessionTimestamp(session.lastUsedAt)}</p>
                    </div>
                  </div>

                  {session.isCurrent ? (
                    <p className="text-xs text-ink-muted md:max-w-48">
                      La sesión actual se cierra desde “Cerrar sesión” para limpiar también tus cookies locales.
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary md:self-center"
                      disabled={isRevokingThisSession}
                      onClick={() => revokeMutation.mutate(session.id)}
                    >
                      {isRevokingThisSession ? 'Cerrando...' : 'Cerrar sesión remota'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
