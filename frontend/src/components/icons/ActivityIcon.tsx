/**
 * Anamneo identity icon: clinical activity / vital waveform.
 *
 * An ECG-style waveform with a contained viewing window,
 * communicating clinical monitoring and audit trail.
 * Aligned to Feather's 24px grid and 1.5px stroke.
 *
 * Use instead of FiActivity on: audit section headings,
 * vital-sign panels, clinical-activity summaries.
 */

interface ActivityIconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export function ActivityIcon({ className, 'aria-hidden': ariaHidden = true }: ActivityIconProps) {
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
      {/* ECG waveform — starts low, sharp peak, returns to baseline */}
      <polyline points="2,12 6,12 8,7 10,17 12,10 14,14 16,12 22,12" />
    </svg>
  );
}
