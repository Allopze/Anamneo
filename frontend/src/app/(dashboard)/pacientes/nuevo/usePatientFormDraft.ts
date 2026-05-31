'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { isSharedDeviceModeEnabled } from '@/stores/privacy-settings-store';
import { encryptPhiJson, decryptPhiJson, isEncryptedPhiEnvelope } from '@/lib/local-phi-crypto';
import type { PatientForm } from './nuevo.constants';

const DRAFT_KEY_PREFIX = 'anamneo:patient-new-draft';
const DRAFT_VERSION = 1;
const AUTOSAVE_DEBOUNCE_MS = 800;
const DRAFT_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — sessionStorage anyway

function getDraftKey(userId: string) {
  return `${DRAFT_KEY_PREFIX}:v${DRAFT_VERSION}:${userId}`;
}

interface DraftEnvelope {
  version: number;
  savedAt: string;
  data: Partial<PatientForm>;
}

export async function readPatientFormDraft(userId: string): Promise<Partial<PatientForm> | null> {
  if (typeof window === 'undefined') return null;
  if (isSharedDeviceModeEnabled()) return null;
  try {
    const raw = window.sessionStorage.getItem(getDraftKey(userId));
    if (!raw) return null;
    const envelope = JSON.parse(raw) as unknown;
    if (!isEncryptedPhiEnvelope(envelope)) {
      window.sessionStorage.removeItem(getDraftKey(userId));
      return null;
    }
    const parsed = await decryptPhiJson<DraftEnvelope>(envelope);
    if (!parsed || parsed.version !== DRAFT_VERSION || !parsed.data) return null;
    if (Date.now() - new Date(parsed.savedAt).getTime() > DRAFT_TTL_MS) {
      window.sessionStorage.removeItem(getDraftKey(userId));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

async function writePatientFormDraft(userId: string, data: Partial<PatientForm>): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isSharedDeviceModeEnabled()) return;
  try {
    const envelope = await encryptPhiJson({
      version: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      data,
    } satisfies DraftEnvelope);
    window.sessionStorage.setItem(getDraftKey(userId), JSON.stringify(envelope));
  } catch {
    // silently ignore — draft is best-effort
  }
}

export function clearPatientFormDraft(userId: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(getDraftKey(userId));
}

/**
 * Auto-saves react-hook-form values to sessionStorage (encrypted) and restores on mount.
 * Also registers a `beforeunload` warning when the form is dirty.
 *
 * Call `clearPatientFormDraft(userId)` after a successful submit.
 */
export function usePatientFormDraft(
  form: UseFormReturn<PatientForm>,
  userId: string | undefined,
  isDirty: boolean,
): {
  pendingNavigationHref: string | null;
  clearPendingNavigation: () => void;
} {
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const clearPendingNavigation = useCallback(() => setPendingNavigationHref(null), []);

  // Restore draft on mount
  useEffect(() => {
    if (!userId) return;
    void readPatientFormDraft(userId).then((draft) => {
      if (!draft) return;
      // Only restore if form is still pristine (user hasn't started typing)
      if (form.formState.isDirty) return;
      form.reset(draft as PatientForm, { keepDefaultValues: false });
    });
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Autosave on change (debounced)
  useEffect(() => {
    if (!userId || !isDirty) return;

    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      const values = form.getValues();
      void writePatientFormDraft(userId, values);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, [userId, isDirty, form]);

  // beforeunload warning
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Guard in-app link navigation; the encrypted draft still remains recoverable.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!target || !(target instanceof HTMLAnchorElement)) return;
      if (target.target && target.target !== '_self') return;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigationHref(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isDirty]);

  return { pendingNavigationHref, clearPendingNavigation };
}
