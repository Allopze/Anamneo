'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Registers a `beforeunload` warning and intercepts in-app link navigation
 * when the form has unsaved changes.
 *
 * Returns `pendingNavigationHref` when an in-app link was intercepted, and
 * `clearPendingNavigation` to dismiss the guard (call after the user confirms
 * or cancels the navigation).
 */
export function useUnsavedChangesGuard(isDirty: boolean): {
  pendingNavigationHref: string | null;
  clearPendingNavigation: () => void;
} {
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const clearPendingNavigation = useCallback(() => setPendingNavigationHref(null), []);

  // Browser beforeunload warning (e.g. closing tab / hard navigation)
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Guard in-app link navigation (<a href="…">)
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
