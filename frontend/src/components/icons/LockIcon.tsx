/**
 * Anamneo identity icon: secure lock.
 *
 * A cleaner lock glyph with a taller body and rounded shackle,
 * communicating confidentiality in auth and password flows.
 * Aligned to Feather's 24px grid and 1.5px stroke.
 *
 * Use instead of FiLock on: password inputs, 2FA sections,
 * signed/locked encounter banners.
 */

interface LockIconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export function LockIcon({ className, 'aria-hidden': ariaHidden = true }: LockIconProps) {
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
      {/* Shackle */}
      <path d="M8 10 L8 7 C8 4.8 9.8 3 12 3 C14.2 3 16 4.8 16 7 L16 10" />
      {/* Body */}
      <rect x="5" y="10" width="14" height="11" rx="2" />
      {/* Keyhole */}
      <circle cx="12" cy="15.5" r="1.5" />
    </svg>
  );
}
