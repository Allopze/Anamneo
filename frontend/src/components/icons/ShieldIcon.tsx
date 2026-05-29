/**
 * Anamneo identity icon: clinical shield.
 *
 * A refined shield glyph for security, consent, and trust surfaces.
 * Aligned to Feather's 24px grid and 1.5px stroke, but with a subtle
 * inset cross detail that signals clinical identity over generic security.
 *
 * Use instead of FiShield on: login/register hero, 2FA flows,
 * consent banners, legal/security section headings.
 */

interface ShieldIconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export function ShieldIcon({ className, 'aria-hidden': ariaHidden = true }: ShieldIconProps) {
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
      {/* Shield body */}
      <path d="M12 2 L20 5.5 L20 12 C20 16.4 16.4 20.4 12 22 C7.6 20.4 4 16.4 4 12 L4 5.5 Z" />
      {/* Cross detail — clinical identity */}
      <line x1="12" y1="9" x2="12" y2="15" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  );
}
