'use client';

/**
 * Internal presentational helpers for EncounterSectionRail.
 * Not part of the public export surface.
 */

import clsx from 'clsx';
import React from 'react';
import { FiCheck, FiSlash, FiChevronDown } from 'react-icons/fi';
import type { Encounter } from '@/types';
import { SECTION_STATUS_META } from './encounter-wizard.constants';

export type SectionType = NonNullable<Encounter['sections']>[number];

// ── SectionDot — collapsed-rail icon button ──────────────────────

export function SectionDot({
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

// ── SectionRow — expanded-rail row button ────────────────────────

export function SectionRow({
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
        'group grid w-full grid-cols-[28px_minmax(0,1fr)] items-start gap-2.5 rounded-card border px-3 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20',
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
          <span
            className="mt-0.5 block truncate text-[11px] text-ink-muted"
            title={section.notApplicableReason}
          >
            {section.notApplicableReason}
          </span>
        )}
      </span>
    </button>
  );
}

// ── renderSectionItems — builds the rail nav item list ───────────

export function renderSectionItems({
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
  const doneCount = sections.filter(
    (s, i) => (s.completed || s.notApplicable) && i !== currentSectionIndex,
  ).length;
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
            onClick={() => setRailCompletedCollapsed((p) => !p)}
            aria-expanded={!railCompletedCollapsed}
            className="flex w-full items-center gap-2.5 rounded-card border border-transparent px-3 py-2 text-left text-xs font-medium text-ink-secondary transition-colors hover:border-surface-muted/40 hover:bg-surface-base/45"
          >
            <span className="flex size-7 items-center justify-center rounded-input border border-status-green/40 bg-status-green/14 text-status-green-text">
              <FiCheck className="h-3 w-3" />
            </span>
            <span>{collapsibleItems.length} completas</span>
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
