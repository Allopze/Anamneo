import React from 'react';
import clsx from 'clsx';

interface ScrollableTableProps {
  /** Descriptive label for screen readers (required for accessibility). */
  'aria-label': string;
  /** Extra classes applied to the scroll container. */
  className?: string;
  children: React.ReactNode;
}

/**
 * A container that makes wide tables horizontally scrollable with proper
 * accessibility semantics: `role="region"`, a descriptive `aria-label`, and
 * `tabIndex={0}` so keyboard users can scroll the region.
 *
 * Usage:
 *   <ScrollableTable aria-label="Registros de auditoría con desplazamiento horizontal">
 *     <table className="min-w-[1120px] w-full …">…</table>
 *   </ScrollableTable>
 */
export function ScrollableTable({
  'aria-label': ariaLabel,
  className,
  children,
}: ScrollableTableProps) {
  return (
    <div
      className={clsx('overflow-x-auto', className)}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
