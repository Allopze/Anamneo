import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { FiCheck, FiSlash, FiChevronDown, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import type { Encounter, SectionKey } from '@/types';
import type { EncounterWizardHook } from './useEncounterWizard';
import { RAIL_PANEL_CLASS, SECTION_STATUS_META, WORKSPACE_STICKY_OFFSET_CLASS } from './encounter-wizard.constants';

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
  const railPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = railPanelRef.current;
    if (!panel || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let scrollParent: HTMLElement | Window = window;
    let parent = panel.parentElement;
    while (parent && parent !== document.body) {
      const overflowY = window.getComputedStyle(parent).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        scrollParent = parent;
        break;
      }
      parent = parent.parentElement;
    }

    let animationFrame = 0;
    let currentOffset = 0;
    let targetOffset = 0;
    const readScrollTop = () => (scrollParent === window ? window.scrollY : (scrollParent as HTMLElement).scrollTop);

    const settle = () => {
      currentOffset += (targetOffset - currentOffset) * 0.16;

      if (Math.abs(targetOffset - currentOffset) < 0.1) {
        currentOffset = targetOffset;
      }

      panel.style.setProperty('--section-rail-inertia-y', `${currentOffset.toFixed(2)}px`);
      animationFrame = currentOffset === targetOffset ? 0 : window.requestAnimationFrame(settle);
    };

    const handleScroll = () => {
      targetOffset = Math.min(28, Math.max(0, readScrollTop() * 0.05));

      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(settle);
      }
    };

    handleScroll();
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollParent.removeEventListener('scroll', handleScroll);
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <aside
      className={clsx(
        'hidden xl:block xl:w-full xl:self-start xl:justify-self-start xl:sticky',
        WORKSPACE_STICKY_OFFSET_CLASS,
      )}
    >
      <div
        ref={railPanelRef}
        className={clsx(
          RAIL_PANEL_CLASS,
          railCollapsed ? 'rounded-xl' : 'rounded-card',
          'motion-safe:transition-[width,border-radius,border-color,background-color] motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none will-change-transform',
        )}
        style={{
          transform: 'translateY(var(--section-rail-inertia-y, 0px))',
        }}
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
            className="flex w-full items-center justify-center gap-2 rounded-card border border-transparent px-2 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-surface-muted/40 hover:bg-surface-base/45"
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

// ─── Internal helpers ──────────────────────────────────────────

type SectionType = NonNullable<Encounter['sections']>[number];

function renderSectionItems({
  sections,
  currentSectionIndex,
  railCollapsed,
  railCompletedCollapsed,
  setRailCompletedCollapsed,
  getSectionUiState,
  moveToSection,
}: {
  sections: SectionType[];
  currentSectionIndex: number;
  railCollapsed: boolean;
  railCompletedCollapsed: boolean;
  setRailCompletedCollapsed: (fn: (v: boolean) => boolean) => void;
  getSectionUiState: (s: SectionType) => keyof typeof SECTION_STATUS_META;
  moveToSection: (i: number) => void;
}) {
  const doneCount = sections.filter((s, i) => (s.completed || s.notApplicable) && i !== currentSectionIndex).length;
  const shouldOfferCollapse = doneCount >= 3;
  const collapsibleItems: React.ReactNode[] = [];
  const fixedItems: (React.ReactNode | 'SLOT')[] = [];
  let hasInsertedCollapsibleSlot = false;

  sections.forEach((section, index) => {
    const sectionState = getSectionUiState(section);
    const sectionStatusMeta = SECTION_STATUS_META[sectionState];
    const isActive = index === currentSectionIndex;
    const isDone = section.completed || section.notApplicable;
    const isCollapsible = isDone && !isActive && shouldOfferCollapse;

    const node = railCollapsed ? (
      <SectionDot
        key={section.id}
        section={section}
        index={index}
        isActive={isActive}
        onClick={() => moveToSection(index)}
      />
    ) : (
      <SectionRow
        key={section.id}
        section={section}
        index={index}
        isActive={isActive}
        sectionStatusMeta={sectionStatusMeta}
        onClick={() => moveToSection(index)}
      />
    );

    if (isCollapsible) {
      collapsibleItems.push(node);
    } else {
      if (collapsibleItems.length > 0 && !hasInsertedCollapsibleSlot) {
        fixedItems.push('SLOT');
        hasInsertedCollapsibleSlot = true;
      }
      fixedItems.push(node);
    }
  });

  if (collapsibleItems.length > 0 && !hasInsertedCollapsibleSlot) {
    fixedItems.push('SLOT');
    hasInsertedCollapsibleSlot = true;
  }

  if (!shouldOfferCollapse || railCollapsed) {
    return [...fixedItems, ...collapsibleItems];
  }

  return fixedItems.map((item, i) => {
    if (item === 'SLOT') {
      return (
        <div key="collapsible-group">
          <button
            type="button"
            onClick={() => setRailCompletedCollapsed((p: boolean) => !p)}
            aria-expanded={!railCompletedCollapsed}
            className="flex w-full items-center gap-2.5 rounded-card border border-transparent px-3 py-2 text-left text-xs font-medium text-ink-secondary transition-colors hover:border-surface-muted/40 hover:bg-surface-base/45"
          >
            <span className="flex size-7 items-center justify-center rounded-input border border-status-green/40 bg-status-green/14 text-status-green-text">
              <FiCheck className="h-3 w-3" />
            </span>
            <span>{doneCount} completas</span>
            <FiChevronDown
              className={clsx(
                'ml-auto h-3.5 w-3.5 transition-transform duration-200',
                !railCompletedCollapsed && 'rotate-180',
              )}
            />
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: railCompletedCollapsed ? '0fr' : '1fr' }}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-1 pt-1">{collapsibleItems}</div>
            </div>
          </div>
        </div>
      );
    }
    return item;
  });
}

function SectionDot({
  section,
  index,
  isActive,
  onClick,
}: {
  section: SectionType;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex size-9 items-center justify-center rounded-input border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20',
        isActive
          ? 'border-frame/30 bg-surface-base'
          : 'border-transparent shadow-none hover:border-surface-muted/40 hover:bg-surface-base/45',
      )}
      aria-current={isActive ? 'step' : undefined}
      aria-label={section.label}
    >
      <span
        className={clsx(
          'flex size-7 items-center justify-center rounded-input border text-[11px] font-semibold transition-colors duration-200',
          isActive
            ? 'border-status-yellow/70 bg-status-yellow text-accent-text'
            : section.notApplicable
              ? 'border-surface-muted/55 bg-surface-elevated text-ink-secondary'
              : section.completed
                ? 'border-status-green/40 bg-status-green/14 text-status-green-text'
                : 'border-surface-muted/55 bg-surface-elevated text-ink-secondary',
        )}
      >
        {section.notApplicable ? (
          <FiSlash className="h-3.5 w-3.5" />
        ) : section.completed ? (
          <FiCheck className="h-3.5 w-3.5" />
        ) : (
          index + 1
        )}
      </span>
    </button>
  );
}

function SectionRow({
  section,
  index,
  isActive,
  sectionStatusMeta,
  onClick,
}: {
  section: SectionType;
  index: number;
  isActive: boolean;
  sectionStatusMeta: (typeof SECTION_STATUS_META)[keyof typeof SECTION_STATUS_META];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group grid w-full grid-cols-[28px_minmax(0,1fr)] items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20',
        isActive
          ? 'border-frame/30 bg-surface-base'
          : 'border-transparent shadow-none hover:border-surface-muted/40 hover:bg-surface-base/45',
      )}
      aria-current={isActive ? 'step' : undefined}
    >
      <span
        className={clsx(
          'flex size-7 items-center justify-center rounded-input border text-[11px] font-semibold transition-colors duration-200',
          isActive
            ? 'border-status-yellow/70 bg-status-yellow text-accent-text'
            : section.notApplicable
              ? 'border-surface-muted/55 bg-surface-elevated text-ink-secondary'
              : section.completed
                ? 'border-status-green/40 bg-status-green/14 text-status-green-text'
                : 'border-surface-muted/55 bg-surface-elevated text-ink-secondary',
        )}
      >
        {section.notApplicable ? (
          <FiSlash className="h-3.5 w-3.5" />
        ) : section.completed ? (
          <FiCheck className="h-3.5 w-3.5" />
        ) : (
          index + 1
        )}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-medium leading-snug text-ink">{section.label}</span>
        {!(sectionStatusMeta as any).hidden && (
          <span className={clsx('mt-1 flex items-center gap-2 text-xs', sectionStatusMeta.badgeClassName)}>
            <span className={clsx('h-1.5 w-1.5 rounded-full', sectionStatusMeta.dotClassName)} />
            {sectionStatusMeta.label}
          </span>
        )}
        {section.notApplicable && section.notApplicableReason && (
          <span className="mt-0.5 block truncate text-[11px] text-ink-muted" title={section.notApplicableReason}>
            {section.notApplicableReason}
          </span>
        )}
      </span>
    </button>
  );
}
