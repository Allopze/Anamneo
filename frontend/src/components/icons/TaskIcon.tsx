/**
 * Anamneo identity icon: tarea / seguimiento (follow-up task).
 *
 * A clipboard glyph with an inset checkmark — distinguishes a follow-up task
 * or pending action from a clinical record (FichaIcon) or an encounter
 * (EncounterIcon). Replaces the generic FiClipboard on task/seguimiento
 * surfaces.
 *
 * Aligned to Feather's 24px grid and 1.5px stroke.
 * Use instead of FiClipboard on: seguimientos nav/empty states, "tareas
 * vencidas/pendientes" KPI chips, follow-up badges in patient timelines.
 * Do NOT use for clinical records (use FichaIcon) or encounters (EncounterIcon).
 */

interface TaskIconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export function TaskIcon({ className, 'aria-hidden': ariaHidden = true }: TaskIconProps) {
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
      {/* Clipboard clip */}
      <rect x="9" y="2" width="6" height="4" rx="1" />
      {/* Clipboard body */}
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      {/* Check mark — completed/follow-up identity detail */}
      <polyline points="9 13 11 15 15 11" />
    </svg>
  );
}
