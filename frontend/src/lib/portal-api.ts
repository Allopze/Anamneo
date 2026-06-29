import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getErrorMessage } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
const REFRESH_ENDPOINT = '/portal/auth/refresh';
const LOGOUT_ENDPOINT = '/portal/auth/logout';
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const CSRF_COOKIE_NAME = 'csrf_token';

let refreshPromise: Promise<void> | null = null;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function refreshPortalSession() {
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

export const portalApi = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

portalApi.interceptors.request.use((config) => {
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

portalApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!originalRequest) return Promise.reject(error);
    const url = originalRequest.url || '';
    const skipRefresh = url.includes('/portal/auth/login')
      || url.includes('/portal/auth/activate')
      || url.includes(REFRESH_ENDPOINT)
      || url.includes(LOGOUT_ENDPOINT);
    if (error.response?.status === 401 && !originalRequest._retry && !skipRefresh) {
      originalRequest._retry = true;
      try {
        await refreshPortalSession();
        return portalApi(originalRequest);
      } catch (refreshError) {
        window.location.replace('/portal/login');
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export { getErrorMessage };
