import toast, { type ToastOptions } from 'react-hot-toast';

export const feedbackCopy = {
  sessionStarted: 'Sesión iniciada',
  accountCreated: 'Cuenta creada',
  sessionExpiresSoon: 'Tu sesión expirará pronto por inactividad',
} as const;

export const notify = {
  success(message: string, options?: ToastOptions) {
    return options ? toast.success(message, options) : toast.success(message);
  },
  error(message: string, options?: ToastOptions) {
    return options ? toast.error(message, options) : toast.error(message);
  },
  info(message: string, options?: ToastOptions) {
    return options ? toast(message, options) : toast(message);
  },
};
