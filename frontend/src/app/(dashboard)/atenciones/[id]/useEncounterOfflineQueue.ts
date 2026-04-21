import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { writeEncounterSectionConflict, type EncounterSectionConflictBackup } from '@/lib/encounter-draft';
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
  onEncounterSavesSynced?: (info: { encounterIds: string[]; syncedAt: Date }) => void;
}

export async function persistRecoverableOfflineConflict(params: {
  encounterId: string;
  localData: Record<string, unknown>;
  sectionKey: string;
  userId: string;
}) {
  const { encounterId, localData, sectionKey, userId } = params;
  const response = await api.get(`/encounters/${encounterId}`);
  const latestEncounter = response.data as {
    sections?: Array<{ sectionKey: string; data?: Record<string, unknown>; updatedAt: string }>;
  };
  const latestSection = latestEncounter.sections?.find((section) => section.sectionKey === sectionKey);

  if (!latestSection) {
    return false;
  }

  const conflictBackup: EncounterSectionConflictBackup = {
    version: 2,
    encounterId,
    userId,
    sectionKey,
    localData,
    serverData: (latestSection.data ?? {}) as Record<string, unknown>,
    serverUpdatedAt: latestSection.updatedAt,
    savedAt: new Date().toISOString(),
  };
  writeEncounterSectionConflict(conflictBackup);
  return true;
}

export function useEncounterOfflineQueue(params: UseEncounterOfflineQueueParams) {
  const { id, isOnline, onEncounterSavesSynced, queryClient, userId } = params;
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
              try {
                await persistRecoverableOfflineConflict({
                  encounterId: save.encounterId,
                  localData: (save.data ?? {}) as Record<string, unknown>,
                  sectionKey: save.sectionKey,
                  userId: activeUserId,
                });
              } catch {
                // Ignore backup refresh failures; the main conflict remains user-visible via toast.
              }
              await removePendingSave(save.id!);
              conflicts++;
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
          const syncedAt = new Date();
          toast.success(`${synced} cambio${synced > 1 ? 's' : ''} sincronizado${synced > 1 ? 's' : ''}`);
          onEncounterSavesSynced?.({ encounterIds: [...syncedEncounterIds], syncedAt });
        }
        if (conflicts > 0) {
          toast.error(
            `${conflicts} guardado${conflicts > 1 ? 's' : ''} offline entr${conflicts > 1 ? 'aron' : 'ó'} en conflicto. Se conservó una copia local recuperable.`,
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
  }, [id, isOnline, onEncounterSavesSynced, queryClient, userId]);

  useEffect(() => {
    void refreshPendingSaveCount();
  }, [refreshPendingSaveCount]);

  return {
    pendingSaveCount,
    enqueueOfflineSave,
    refreshPendingSaveCount,
  };
}
