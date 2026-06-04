import clsx from 'clsx';
import { FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import type { EncounterWizardHook } from './useEncounterWizard';
import { RAIL_PANEL_CLASS, WORKSPACE_STICKY_OFFSET_CLASS } from './encounter-wizard.constants';
import { renderSectionItems } from './EncounterSectionRail.parts';

type Props = Pick<
  EncounterWizardHook,
  | 'sections'
  | 'currentSectionIndex'
  | 'railCollapsed'
  | 'setRailCollapsed'
  | 'railCompletedCollapsed'
  | 'setRailCompletedCollapsed'
  | 'getSectionUiState'
  | 'moveToSection'
>;

export default function EncounterSectionRail({
  sections,
  currentSectionIndex,
  railCollapsed,
  setRailCollapsed,
  railCompletedCollapsed,
  setRailCompletedCollapsed,
  getSectionUiState,
  moveToSection,
}: Props) {
  const completedOrNACount = sections.filter((s) => s.completed || s.notApplicable).length;

  return (
    <aside
      className={clsx(
        'hidden xl:block xl:w-full xl:self-start xl:justify-self-start xl:sticky',
        WORKSPACE_STICKY_OFFSET_CLASS,
      )}
    >
      <div
        className={clsx(
          RAIL_PANEL_CLASS,
          railCollapsed ? 'rounded-card' : 'rounded-card',
          'max-h-[calc(100vh-18rem)] overflow-y-auto motion-safe:transition-[width,border-radius,border-color,background-color] motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none',
        )}
      >
        {/* Header — hidden when collapsed */}
        {!railCollapsed && (
          <div className="border-b border-surface-muted/35 px-5 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Secciones</h2>
              <span className="text-xs font-medium text-ink-secondary">
                {completedOrNACount}/{sections.length}
              </span>
            </div>
            <div
              className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-muted/50"
              role="progressbar"
              aria-label="Progreso de secciones completadas"
              aria-valuemin={0}
              aria-valuemax={sections.length}
              aria-valuenow={completedOrNACount}
            >
              <div
                className="h-full rounded-full bg-frame transition-[width] duration-200"
                style={{ width: `${(completedOrNACount / sections.length) * 100}%` }}
              />
            </div>
          </div>
        )}
        <nav
          className={clsx('flex flex-col gap-1 py-2', railCollapsed ? 'items-center px-2' : 'px-3')}
          aria-label="Secciones de la atención"
        >
          {renderSectionItems({
            sections,
            currentSectionIndex,
            railCollapsed,
            railCompletedCollapsed,
            setRailCompletedCollapsed,
            getSectionUiState,
            moveToSection,
          })}
        </nav>

        {/* Rail collapse toggle */}
        <div className={clsx('border-t border-surface-muted/35', railCollapsed ? 'px-2 py-2' : 'px-3 py-2')}>
          <button
            type="button"
            onClick={() =>
              setRailCollapsed((prev: boolean) => {
                const next = !prev;
                localStorage.setItem('anamneo:encounter-rail-collapsed', next ? '1' : '0');
                return next;
              })
            }
            className="flex w-full items-center justify-center gap-2 rounded-btn border border-transparent px-2 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-surface-muted/40 hover:bg-surface-base/45"
            aria-label={railCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            {railCollapsed ? (
              <FiChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <FiChevronsLeft className="h-4 w-4" />
                <span>Colapsar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
