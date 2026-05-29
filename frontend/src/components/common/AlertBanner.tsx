import type { ReactNode } from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiWifiOff } from 'react-icons/fi';

type AlertBannerVariant = 'error' | 'warning' | 'info' | 'success' | 'offline';

interface AlertBannerProps {
  title?: string;
  message: ReactNode;
  variant?: AlertBannerVariant;
  action?: ReactNode;
  className?: string;
}

const variantStyles: Record<AlertBannerVariant, { shell: string; icon: string; iconNode: ReactNode; role: 'alert' | 'status' }> = {
  error: {
    shell: 'border-status-red/35 bg-status-red/10 text-status-red-text',
    icon: 'text-status-red-text',
    iconNode: <FiAlertCircle className="h-5 w-5" aria-hidden="true" />,
    role: 'alert',
  },
  warning: {
    shell: 'border-status-yellow/70 bg-status-yellow/35 text-accent-text',
    icon: 'text-accent-text',
    iconNode: <FiAlertCircle className="h-5 w-5" aria-hidden="true" />,
    role: 'status',
  },
  info: {
    shell: 'border-surface-muted/60 bg-surface-inset/75 text-ink-secondary',
    icon: 'text-ink-muted',
    iconNode: <FiInfo className="h-5 w-5" aria-hidden="true" />,
    role: 'status',
  },
  success: {
    shell: 'border-status-green/45 bg-status-green/20 text-status-green-text',
    icon: 'text-status-green-text',
    iconNode: <FiCheckCircle className="h-5 w-5" aria-hidden="true" />,
    role: 'status',
  },
  offline: {
    shell: 'border-status-yellow/70 bg-status-yellow/35 text-accent-text',
    icon: 'text-accent-text',
    iconNode: <FiWifiOff className="h-5 w-5" aria-hidden="true" />,
    role: 'status',
  },
};

export function AlertBanner({
  title,
  message,
  variant = 'info',
  action,
  className = '',
}: AlertBannerProps) {
  const styles = variantStyles[variant];

  return (
    <div
      role={styles.role}
      aria-live={styles.role === 'alert' ? 'assertive' : 'polite'}
      className={`flex items-start gap-3 rounded-card border px-4 py-3 text-sm shadow-none ${styles.shell} ${className}`}
    >
      <span className={`mt-0.5 shrink-0 ${styles.icon}`}>{styles.iconNode}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-current">{title}</p>}
        <div className={title ? 'mt-1 leading-6' : 'leading-6'}>{message}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
