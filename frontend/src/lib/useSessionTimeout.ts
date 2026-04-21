'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000; // warn 2 min before
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;

/**
 * Hook that logs the user out after a period of inactivity.
 * Fires a warning callback 2 minutes before the timeout.
 */
export function useSessionTimeout(onWarning?: () => void, inactivityTimeoutMs = INACTIVITY_TIMEOUT_MS) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performLogout = useCallback(async () => {
    logout();
    try {
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    router.replace('/login?reason=inactivity');
  }, [logout, router]);

  const resetTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    warningRef.current = setTimeout(() => {
      onWarning?.();
    }, Math.max(inactivityTimeoutMs - WARNING_BEFORE_MS, 0));

    timeoutRef.current = setTimeout(() => {
      void performLogout();
    }, inactivityTimeoutMs);
  }, [inactivityTimeoutMs, performLogout, onWarning]);

  useEffect(() => {
    if (!isAuthenticated) return;

    resetTimers();

    const handler = () => resetTimers();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handler, { passive: true });
    }

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handler);
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [isAuthenticated, resetTimers]);
}
