import type { QueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { getErrorMessage } from '@/lib/api';
import { clearEncounterSectionConflict } from '@/lib/encounter-draft';
import { invalidateAlertOverviewQueries } from '@/lib/query-invalidation';
import { notify } from '@/lib/notify';
import type { PendingSave } from '@/lib/offline-queue';
import { isNetworkError } from '@/lib/offline-queue';
import { isSharedDeviceModeEnabled } from '@/stores/privacy-settings-store';
import type { Encounter, SectionKey } from '@/types';
import type { SaveSectionResponse } from './encounter-wizard.constants';
import {
  getSectionPayloadData,
  readSavedSnapshot,
  refreshSectionFromServer,
  type RefreshSectionContext,
  type SaveSectionMutationVars,
} from './useEncounterSectionSaveFlow.helpers';

export interface SaveSectionSuccessCtx extends RefreshSectionContext {
  formDataRef: React.MutableRefObject<Record<string, any>>;
  saveStatusTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

export interface SaveSectionErrorCtx {
  id: string;
  userId: string | undefined;
  encounter: Encounter | undefined;
  sections: NonNullable<Encounter['sections']>;
  formDataRef: React.MutableRefObject<Record<string, any>>;
  enqueueOfflineSave: (save: Omit<PendingSave, 'id'>) => Promise<void>;
  queryClient: QueryClient;
  refreshCtx: RefreshSectionContext;
  setErrorSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setSavingSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setSavedSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<'idle' | 'saving' | 'saved' | 'queued' | 'error'>>;
}

export async function handleSaveSectionSuccess(
  response: { data: SaveSectionResponse },
  variables: SaveSectionMutationVars,
  ctx: SaveSectionSuccessCtx,
) {
  const savedSnapshot = readSavedSnapshot(ctx.lastSavedRef);
  const normalizedSectionData = response.data.data;
  if (response.data.updatedAt) {
    ctx.latestSectionUpdatedAtRef.current[variables.sectionKey] = response.data.updatedAt;
  }
  savedSnapshot[variables.sectionKey] = normalizedSectionData;
  ctx.lastSavedRef.current = JSON.stringify(savedSnapshot);
  ctx.setSavedSnapshotJson(ctx.lastSavedRef.current);
  ctx.setFormData((previous) => ({ ...previous, [variables.sectionKey]: normalizedSectionData }));

  ctx.queryClient.setQueryData<Encounter | undefined>(['encounter', ctx.id], (previous) => {
    if (!previous?.sections) return previous;
    return {
      ...previous,
      sections: previous.sections.map((section) =>
        section.sectionKey === variables.sectionKey
          ? {
              ...section,
              data: normalizedSectionData,
              completed: response.data.completed,
              notApplicable: response.data.notApplicable,
              notApplicableReason: response.data.notApplicableReason,
              updatedAt: response.data.updatedAt,
            }
          : section,
      ),
    };
  });

  const activeSectionKey = ctx.activeSectionKeyRef.current;
  if (activeSectionKey) {
    const activeData = JSON.stringify(ctx.formDataRef.current[activeSectionKey]);
    const activeSavedData = JSON.stringify(savedSnapshot[activeSectionKey]);
    ctx.setHasUnsavedChanges(activeData !== activeSavedData);
  } else {
    ctx.setHasUnsavedChanges(false);
  }

  ctx.setSavingSectionKey(null);
  ctx.setSavedSectionKey(variables.sectionKey);
  ctx.setErrorSectionKey(null);
  if (ctx.userId) {
    clearEncounterSectionConflict(ctx.id, ctx.userId, variables.sectionKey);
  }
  ctx.setRecoverableConflicts((current) => current.filter((item) => item.sectionKey !== variables.sectionKey));
  ctx.setRecoverableConflict((current) => current?.sectionKey === variables.sectionKey ? null : current);
  ctx.setSaveStatus('saved');
  ctx.setLastSavedAt(new Date());
  ctx.setLastSaveOrigin('direct');
  response.data.warnings?.forEach((warning) => notify.info(warning));

  if (variables.sectionKey === 'EXAMEN_FISICO') {
    await invalidateAlertOverviewQueries(ctx.queryClient);
  }

  ctx.saveStatusTimerRef.current = setTimeout(() => {
    ctx.setSaveStatus('idle');
    ctx.setSavedSectionKey((current) => (current === variables.sectionKey ? null : current));
  }, 2000);
}

export function handleSaveSectionError(
  error: unknown,
  variables: SaveSectionMutationVars,
  ctx: SaveSectionErrorCtx,
) {
  ctx.setSavingSectionKey(null);
  ctx.setSavedSectionKey(null);

  if (isNetworkError(error) && ctx.id && ctx.userId) {
    if (isSharedDeviceModeEnabled()) {
      ctx.setErrorSectionKey(variables.sectionKey);
      ctx.setSaveStatus('error');
      notify.error(
        'Sin conexión. El modo equipo compartido desactiva borradores y cola offline local; reconecte antes de continuar.',
      );
      return;
    }

    void ctx
      .enqueueOfflineSave({
        encounterId: ctx.id,
        sectionKey: variables.sectionKey,
        data: variables.data,
        baseUpdatedAt: variables.baseUpdatedAt,
        completed: variables.completed,
        notApplicable: variables.notApplicable,
        notApplicableReason: variables.notApplicableReason,
        queuedAt: new Date().toISOString(),
        userId: ctx.userId,
      })
      .catch(() => {
        ctx.setErrorSectionKey(variables.sectionKey);
        ctx.setSaveStatus('error');
        notify.error('No se pudo encolar el guardado offline. Reintente manualmente.');
      });
    ctx.setErrorSectionKey(null);
    ctx.setSaveStatus('queued');
    notify.info('Sin conexión. Guardado en cola local.');
    return;
  }

  ctx.setErrorSectionKey(variables.sectionKey);
  ctx.setSaveStatus('error');

  if (axios.isAxiosError(error) && error.response?.status === 409) {
    const localConflictData = (variables.data ??
      getSectionPayloadData({
        encounter: ctx.encounter,
        sections: ctx.sections,
        formDataRef: ctx.formDataRef,
        sectionKey: variables.sectionKey,
      })) as Record<string, unknown>;

    void refreshSectionFromServer(variables.sectionKey, localConflictData, ctx.refreshCtx)
      .then(() =>
        notify.error('La sección cambió en otra sesión. Se guardó tu copia local para que puedas recuperarla.'),
      )
      .catch(() => {
        void ctx.queryClient.invalidateQueries({ queryKey: ['encounter', ctx.id] });
        notify.error('La sección cambió en otra sesión. Recargue la atención y revise antes de reintentar.');
      });
    return;
  }

  notify.error('Error al guardar: ' + getErrorMessage(error));
}
