import type { User } from '@/stores/auth-store';

export interface AuthSessionUser {
  id: string;
  email: string;
  nombre: string;
  role: User['role'];
  isAdmin?: boolean;
  medicoId?: string | null;
  mustChangePassword?: boolean;
  totpEnabled?: boolean;
}

const AUTH_SESSION_PREFILL_KEY = 'anamneo:auth-session-prefill';

export function toAuthUser(user: AuthSessionUser): User {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    role: user.role,
    isAdmin: !!user.isAdmin,
    medicoId: user.medicoId ?? null,
    mustChangePassword: !!user.mustChangePassword,
    totpEnabled: !!user.totpEnabled,
  };
}

export function stashAuthSessionPrefill(user: AuthSessionUser) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(AUTH_SESSION_PREFILL_KEY, JSON.stringify(user));
}

export function consumeAuthSessionPrefill(): AuthSessionUser | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(AUTH_SESSION_PREFILL_KEY);
  if (!rawValue) {
    return null;
  }

  window.sessionStorage.removeItem(AUTH_SESSION_PREFILL_KEY);

  try {
    return JSON.parse(rawValue) as AuthSessionUser;
  } catch {
    return null;
  }
}

export function clearAuthSessionPrefill() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(AUTH_SESSION_PREFILL_KEY);
}
