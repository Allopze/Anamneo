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
 */

interface ClinicalAlertIconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export function ClinicalAlertIcon({ className, 'aria-hidden': ariaHidden = true }: ClinicalAlertIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Warning triangle */}
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      {/* Medical cross — clinical severity marker */}
      <line x1="12" y1="10" x2="12" y2="16" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  );
}
