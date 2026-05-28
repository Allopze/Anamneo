import { useEffect, useRef } from 'react';
import { api } from './api';

const POLL_INTERVAL_MS = 60_000;

export function useServerSessionCheck(onExpired: () => void) {
  const callbackRef = useRef(onExpired);
  callbackRef.current = onExpired;

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await api.get('/auth/me');
      } catch (error: unknown) {
        if ((error as { response?: { status?: number } })?.response?.status === 401) {
          callbackRef.current();
        }
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
}
