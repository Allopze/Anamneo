import { useEffect, useRef, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import clsx from 'clsx';

export interface ToolbarMenuItem {
  key: string;
  label: string;
  icon: IconType;
  onSelect: () => void;
  disabled?: boolean;
  title?: string;
}

interface ToolbarMenuProps {
  label: string;
  ariaLabel: string;
  icon: IconType;
  items: ToolbarMenuItem[];
  compactLabel?: boolean;
}

export function FichaToolbarMenu({
  label,
  ariaLabel,
  icon: Icon,
  items,
  compactLabel = false,
}: ToolbarMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    firstItemRef.current?.focus();

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!items.length) {
    return null;
  }

  const firstFocusableIndex = Math.max(items.findIndex((item) => !item.disabled), 0);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className="btn btn-secondary flex items-center gap-2 px-3 py-2"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Icon className="h-4 w-4" />
        <span className={clsx(compactLabel && 'hidden sm:inline')}>{label}</span>
        <FiChevronDown className="hidden h-3.5 w-3.5 text-ink-muted sm:block" aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-card border border-surface-muted/40 bg-surface-elevated py-1 shadow-dropdown"
          role="menu"
          aria-label={ariaLabel}
        >
          {items.map((item, index) => {
            const ItemIcon = item.icon;
            return (
              <button
                key={item.key}
                ref={index === firstFocusableIndex ? firstItemRef : undefined}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                title={item.title}
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-inset focus:bg-surface-inset focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ItemIcon className="h-4 w-4 shrink-0 text-ink-secondary" />
                <span className="min-w-0 truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
