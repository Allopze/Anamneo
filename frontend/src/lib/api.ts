import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth-store';
import { buildLoginRedirectPath, getCurrentAppPath } from '@/lib/login-redirect';
import { clearAuthSessionPrefill } from './auth-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
const REFRESH_ENDPOINT = '/auth/refresh';
const LOGOUT_ENDPOINT = '/auth/logout';
const TOTP_VERIFY_ENDPOINT = '/auth/2fa/verify';

let refreshPromise: Promise<void> | null = null;
let loginRedirectInProgress = false;

export function shouldSkipRefresh(url?: string): boolean {
  if (!url) return false;

  return (
    url.includes('/auth/login')
    || url.includes('/auth/register')
    || url.includes('/public/derechos')
    || url.includes('/public/data-request-downloads/')
    || url.includes(TOTP_VERIFY_ENDPOINT)
    || url.includes(REFRESH_ENDPOINT)
    || url.includes(LOGOUT_ENDPOINT)
  );
}

async function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}${REFRESH_ENDPOINT}`, {}, { withCredentials: true })
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function clearSessionAndRedirectToLogin(): Promise<void> {
  useAuthStore.getState().logout();
  clearAuthSessionPrefill();

  try {
    await axios.post(`${API_URL}${LOGOUT_ENDPOINT}`, {}, { withCredentials: true });
  } catch {
    // Ignore network/API logout failures; local session is already cleared.
  }

  if (typeof window !== 'undefined' && !loginRedirectInProgress) {
    loginRedirectInProgress = true;
    window.location.replace(buildLoginRedirectPath(getCurrentAppPath(window.location)));
  }
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with every request
});

const CSRF_COOKIE_NAME = 'csrf_token';
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// Request interceptor - attach CSRF token on mutating requests (double-submit cookie)
api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (MUTATING_METHODS.has(method)) {
    const token = readCookie(CSRF_COOKIE_NAME);
    if (token) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)['X-CSRF-Token'] = token;
    }
  }
  return config;
});

// Response interceptor - handle token refresh via cookie
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const skipRefresh = shouldSkipRefresh(originalRequest.url);

    // If 401 and not already retried, try silent refresh
    if (error.response?.status === 401 && !originalRequest._retry && !skipRefresh) {
      originalRequest._retry = true;

      try {
        await refreshSession();
        // Retry original request — new access_token cookie is set
        return api(originalRequest);
      } catch (refreshError) {
        await clearSessionAndRedirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401 && !skipRefresh) {
      await clearSessionAndRedirectToLogin();
    }

    // Consent enforcement redirect (Ley 21.719 Art 12)
    const consentData = error.response?.data as { code?: string; patientId?: string } | undefined;
    if (
      error.response?.status === 403 &&
      consentData?.code === 'PATIENT_CONSENT_REQUIRED' &&
      consentData?.patientId &&
      typeof window !== 'undefined'
    ) {
      window.location.assign(`/pacientes/${consentData.patientId}`);
    }

    return Promise.reject(error);
  }
);

// API helper types
export interface ApiError {
  message: string | string[];
  statusCode: number;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Frontend messages for known domain error codes.
 * Takes precedence over the backend message string and HTTP-status fallbacks.
 * Add an entry here whenever the backend adds a new `code` to a domain throw.
 */
const DOMAIN_CODE_MESSAGES: Record<string, string> = {
  // Encounter creation conflicts
  APPOINTMENT_ENCOUNTER_EXISTS:
    'Esta cita ya tiene una atención registrada. Abre la atención existente para continuar.',
  ENCOUNTER_MULTIPLE_IN_PROGRESS:
    'Hay varias atenciones en progreso para este paciente. Selecciona cuál abrir.',
  // Concurrent edit conflict
  ENCOUNTER_SECTION_STALE:
    'Esta sección fue modificada en otra sesión. Recarga la atención y revisa los cambios antes de guardar.',
  // Patient blocking idempotency
  PATIENT_ALREADY_BLOCKED:
    'El paciente ya está bloqueado. No es necesario bloquearlo nuevamente.',
  PATIENT_NOT_BLOCKED:
    'El paciente no está bloqueado. Verifica el estado antes de desbloquear.',
  // Patient RUT uniqueness
  DUPLICATE_RUT_CONFLICT:
    'Ya existe un paciente registrado con este RUT. Busca el paciente existente antes de crear uno nuevo.',
  // Auth registration
  USER_EMAIL_ALREADY_EXISTS:
    'Ya existe una cuenta con este correo. Si olvidaste tu contraseña, usa la opción de recuperación.',
  REGISTRATION_REQUIRES_INVITATION:
    'El registro requiere una invitación válida. Solicita al administrador que te invite.',
  // Consent redirect (handled by interceptor; message here as fallback)
  PATIENT_CONSENT_REQUIRED:
    'Se requiere registrar el consentimiento del paciente antes de continuar.',
};

// Extract error message from API response
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;

    // Domain error codes take precedence — precise, recoverable messages per situation.
    if (data && typeof data.code === 'string') {
      const codeMessage = DOMAIN_CODE_MESSAGES[data.code];
      if (codeMessage) return codeMessage;
    }

    // NestJS ValidationPipe can return: { message: string[], error: 'Bad Request', statusCode: 400 }
    if (data) {
      const msg = data.message;
      if (Array.isArray(msg)) {
        return msg.filter(Boolean).join('\n');
      }
      if (typeof msg === 'string' && msg.trim().length > 0) {
        return msg;
      }

      // Some errors can be plain strings
      if (typeof data === 'string' && data.trim().length > 0) {
        return data;
      }

      // Fallback to error field
      if (typeof data.error === 'string' && data.error.trim().length > 0) {
        return data.error;
      }
    }

    // Human-friendly fallbacks by status
    const status = error.response?.status;
    if (!error.response) return 'No se pudo conectar. Revisa tu conexión e intenta nuevamente.';
    if (status === 400) return 'Revisa los datos ingresados e intenta nuevamente.';
    if (status === 401) return 'Tu sesión no está activa. Inicia sesión para continuar.';
    if (status === 403) return 'No tienes permisos para realizar esta acción.';
    if (status === 404) return 'No encontramos el recurso solicitado. Actualiza la vista e intenta nuevamente.';
    if (status === 409) return 'Hay cambios en conflicto. Actualiza la información antes de continuar.';
    if (status === 422) return 'Hay datos que necesitan revisión antes de continuar.';
    if (status === 429) return 'Hay demasiados intentos. Espera un momento antes de reintentar.';
    if (status && status >= 500) return 'El servidor no pudo completar la acción. Intenta nuevamente en unos minutos.';

    return error.message || 'No se pudo completar la acción. Intenta nuevamente.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'No se pudo completar la acción. Intenta nuevamente.';
}
