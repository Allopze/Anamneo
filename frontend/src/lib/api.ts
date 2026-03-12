import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4444/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with every request
});

// Response interceptor - handle token refresh via cookie
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retried, try silent refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // refresh_token cookie is sent automatically
        await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        // Retry original request — new access_token cookie is set
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
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

// Extract error message from API response
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;

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
    if (status === 403) return 'No tiene permisos para realizar esta acción';
    if (status === 404) return 'Recurso no encontrado';
    if (status === 429) return 'Demasiados intentos. Por favor espere un momento antes de reintentar.';

    return error.message || 'Error desconocido';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Error desconocido';
}
