/**
 * Anamneo identity icon: ficha clínica (clinical record document).
 *
 * A document glyph with an inset medical cross — distinguishes the clinical
 * record from generic text files or non-clinical documents.
 *
 * Aligned to Feather's 24px grid and 1.5px stroke.
 * Use instead of FiFileText on: atenciones list, encounter navigation items,
 * sidebar encounter links, search results for encounters, DashboardSidebarParts.
 * Do NOT use for generic documents (consents, legal, templates, portal).
 */

interface FichaIconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export function FichaIcon({ className, 'aria-hidden': ariaHidden = true }: FichaIconProps) {
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
      {/* Document body with folded corner */}
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      {/* Medical cross — clinical identity detail */}
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}
