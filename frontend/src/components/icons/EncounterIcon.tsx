/**
 * Anamneo identity icon: clinical encounter (stethoscope).
 *
 * Represents an active clinical encounter — the act of examining and treating
 * a patient. Use on encounter workspace surfaces, toolbar encounter actions,
 * and anywhere the primary entity is a clinical visit (not a document).
 *
 * Aligned to Feather's 24px grid and 1.5px stroke.
 * Use instead of FiClipboard on: encounter workspace tabs, EncounterToolbar,
 * EncounterClinicalSummaryCard, encounter quick-action buttons.
 */

interface EncounterIconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export function EncounterIcon({ className, 'aria-hidden': ariaHidden = true }: EncounterIconProps) {
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
      {/* Ear tips */}
      <circle cx="6" cy="3" r="1" />
      <circle cx="18" cy="3" r="1" />
      {/* Binaural arch — tubes from ear tips meeting at center junction */}
      <path d="M6 4Q6 9 12 11Q18 9 18 4" />
      {/* Flexible tube from junction to chest piece */}
      <line x1="12" y1="11" x2="12" y2="17" />
      {/* Chest piece (diaphragm) */}
      <circle cx="12" cy="20" r="2.5" />
    </svg>
  );
}
