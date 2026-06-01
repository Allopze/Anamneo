/**
 * Paleta compartida para plantillas de correo (HTML inline).
 *
 * Los emails no pueden usar los tokens CSS del frontend (`var(--surface-*)`)
 * porque los clientes de correo no resuelven custom properties. Este modulo
 * centraliza los hex que antes se redeclaraban inline en cada plantilla, para
 * evitar drift entre correos. Los valores se mantienen identicos a los que ya
 * estaban en uso (sin cambio visual).
 *
 * Regla: no agregar nuevos hex inline en las plantillas; usar `MAIL_COLORS`.
 */
export const MAIL_COLORS = {
  /** Superficie y tipografia base de cualquier correo. */
  neutral: {
    bg: '#f8fafc',
    ink: '#0f172a',
    body: '#475569',
    muted: '#64748b',
    card: '#ffffff',
    border: '#e2e8f0',
  },
  /** Acento operativo (invitaciones, descargas, portal). */
  teal: {
    cta: '#0f766e',
    light: '#ccfbf1',
    dark: '#115e59',
    kicker: '#0f766e',
    onCta: '#ffffff',
  },
  /** Acento de seguridad/critico (reset, incidentes). */
  error: {
    cta: '#dc2626',
    light: '#fee2e2',
    dark: '#991b1b',
    kicker: '#991b1b',
    heading: '#b91c1c',
    onCta: '#ffffff',
  },
} as const;
