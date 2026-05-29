'use client';

import { useEffect, useRef, useState } from 'react';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useAuthUser } from '@/stores/auth-store';
import { countPendingSavesForUser } from '@/lib/offline-queue';

type SyncPhase = 'idle' | 'syncing' | 'done';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const user = useAuthUser();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle');
  const prevOnlineRef = useRef(isOnline);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const startPolling = (userId: string) => {
    stopPolling();
    const tick = async () => {
      const count = await countPendingSavesForUser(userId);
      setPendingCount(count);
      if (count === 0) {
        stopPolling();
        setSyncPhase('done');
        doneTimerRef.current = setTimeout(() => setSyncPhase('idle'), 3000);
      }
    };
    void tick();
    pollIntervalRef.current = setInterval(() => void tick(), 2000);
  };

  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (!isOnline) {
      stopPolling();
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
        doneTimerRef.current = null;
      }
      setSyncPhase('idle');
      setPendingCount(0);
      return;
    }

    if (wasOffline && user?.id) {
      setSyncPhase('syncing');
      startPolling(user.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, user?.id]);

  useEffect(() => {
    return () => {
      stopPolling();
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, []);

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 top-0 z-[100] bg-status-yellow py-2 text-center text-sm font-medium text-accent-text shadow-md"
      >
        Sin conexión. Los cambios de secciones se encolan localmente y se sincronizarán al reconectar.
      </div>
    );
  }

  if (syncPhase === 'syncing') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-accent py-2 text-center text-sm font-medium text-accent-text shadow-soft"
      >
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-text/35 border-t-accent-text" aria-hidden="true" />
        {pendingCount > 0
          ? `Sincronizando ${pendingCount} ${pendingCount === 1 ? 'cambio pendiente' : 'cambios pendientes'}…`
          : 'Sincronizando cambios pendientes…'}
      </div>
    );
  }

  if (syncPhase === 'done') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 top-0 z-[100] bg-status-green py-2 text-center text-sm font-medium text-status-green-text shadow-md"
      >
        Cambios sincronizados correctamente.
      </div>
    );
  }

  return null;
}
