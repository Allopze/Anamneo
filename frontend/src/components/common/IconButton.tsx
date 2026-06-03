import React from 'react';
import clsx from 'clsx';

interface IconButtonProps {
  /** Accessible name for the button (required — icon-only buttons must have one). */
  ariaLabel: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  /** Extra classes to apply in addition to the base `section-icon-button` style. */
  className?: string;
  children: React.ReactNode;
}

/**
 * A small icon-only button with a required accessible name.
 *
 * Uses the shared `.section-icon-button` style so it is visually consistent
 * with `SectionIconButton`. Extra classes can be added via `className`.
 *
 * Prefer this over ad-hoc `<button aria-label="…">` for icon-only actions
 * to ensure the accessible name is never accidentally omitted.
 */
export function IconButton({
  ariaLabel,
  onClick,
  disabled,
  type = 'button',
  className,
  children,
}: IconButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={clsx('section-icon-button', className)}
    >
      {children}
    </button>
  );
}
