/**
 * Anamneo identity icon: critical clinical alert.
 *
 * A warning triangle with an inset medical cross — signals a clinically
 * significant safety alert (GRAVE / FATAL allergy, critical vital sign,
 * high-severity drug interaction). Carries more clinical weight than the
 * generic Feather triangle with exclamation mark.
 *
 * Aligned to Feather's 24px grid and 1.5px stroke.
 * Use instead of FiAlertTriangle on: GRAVE/FATAL allergy badges,
 * critical allergy lists in encounter summaries and ficha clínica.
 * Do NOT replace FiAlertTriangle on generic destructive-action warnings,
 * overdue-task indicators, or form validation errors.
 *
 * The optional `severity` prop swaps the stroke from `currentColor` to a
 * built-in severity gradient (grave → amber/red, fatal → red/deep-red) to
 * reinforce the gravity of the alert without relying on the parent's color.
 */

interface ClinicalAlertIconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  severity?: 'grave' | 'fatal';
}

// On-palette severity ramps (status-yellow → status-red → status-red-text).
const SEVERITY_STOPS: Record<'grave' | 'fatal', [string, string]> = {
  grave: ['#E5D86A', '#D08C84'],
  fatal: ['#D08C84', '#7F1D1D'],
};

export function ClinicalAlertIcon({
  className,
  'aria-hidden': ariaHidden = true,
  severity,
}: ClinicalAlertIconProps) {
  const gradientId = severity ? `anamneo-alert-${severity}` : undefined;
  const stroke = gradientId ? `url(#${gradientId})` : 'currentColor';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      {severity ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SEVERITY_STOPS[severity][0]} />
            <stop offset="100%" stopColor={SEVERITY_STOPS[severity][1]} />
          </linearGradient>
        </defs>
      ) : null}
      {/* Warning triangle */}
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      {/* Medical cross — clinical severity marker */}
      <line x1="12" y1="10" x2="12" y2="16" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  );
}
