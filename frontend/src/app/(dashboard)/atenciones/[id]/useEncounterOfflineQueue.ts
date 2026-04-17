import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import {
  countPendingSavesForUser,
  enqueueSave,
  getPendingSavesForUser,
  removePendingSave,
  type PendingSave,
} from '@/lib/offline-queue';

interface UseEncounterOfflineQueueParams {
  id: string;
  isOnline: boolean;
  queryClient: QueryClient;
  userId?: string;
}

export function useEncounterOfflineQueue(params: UseEncounterOfflineQueueParams) {
  const { id, isOnline, queryClient, userId } = params;
  const [pendingSaveCount, setPendingSaveCount] = useState(0);
  const syncingRef = useRef(false);

  const refreshPendingSaveCount = useCallback(async () => {
    if (!userId) {
      setPendingSaveCount(0);
      return;
    }

    const count = await countPendingSavesForUser(userId);
    setPendingSaveCount(count);
  }, [userId]);

  const enqueueOfflineSave = useCallback(
    async (save: Omit<PendingSave, 'id'>) => {
      await enqueueSave(save);
      await refreshPendingSaveCount();
    },
    [refreshPendingSaveCount],
  );

  useEffect(() => {
    if (!isOnline || syncingRef.current || !userId) return;

    const activeUserId = userId;
    let cancelled = false;

    async function syncQueue() {
      const saves = await getPendingSavesForUser(activeUserId);
      if (saves.length === 0 || cancelled) return;

      syncingRef.current = true;
      const syncedEncounterIds = new Set<string>();
      let synced = 0;
      let conflicts = 0;

      try {
        for (const save of saves) {
          if (cancelled) break;

          try {
            const payload = {
              data: save.data,
              ...(save.baseUpdatedAt ? { baseUpdatedAt: save.baseUpdatedAt } : {}),
              completed: save.completed,
              ...(save.notApplicable !== undefined ? { notApplicable: save.notApplicable } : {}),
              ...(save.notApplicableReason ? { notApplicableReason: save.notApplicableReason } : {}),
            };
            await api.put(`/encounters/${save.encounterId}/sections/${save.sectionKey}`, payload);
            await removePendingSave(save.id!);
            synced++;
            syncedEncounterIds.add(save.encounterId);
          } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 409) {
              await removePendingSave(save.id!);
              conflicts++;
              syncedEncounterIds.add(save.encounterId);
              continue;
            }
            break;
          }
        }
      } finally {
        syncingRef.current = false;
      }

      const remaining = await countPendingSavesForUser(activeUserId);
      if (!cancelled) {
        setPendingSaveCount(remaining);
        if (synced > 0) {
          toast.success(`${synced} cambio${synced > 1 ? 's' : ''} sincronizado${synced > 1 ? 's' : ''}`);
        }
        if (conflicts > 0) {
          toast.error(
            `${conflicts} guardado${conflicts > 1 ? 's' : ''} offline ya no se aplic${conflicts > 1 ? 'an' : 'a'} porque la sección cambió en otra sesión.`,
          );
        }
        if (synced > 0 || conflicts > 0) {
          queryClient.invalidateQueries({ queryKey: ['encounter'] });
        }
      }
    }

    void syncQueue();
    return () => {
      cancelled = true;
    };
  }, [id, isOnline, queryClient, userId]);

  useEffect(() => {
    void refreshPendingSaveCount();
  }, [refreshPendingSaveCount]);

  return {
    pendingSaveCount,
    enqueueOfflineSave,
    refreshPendingSaveCount,
  };
}