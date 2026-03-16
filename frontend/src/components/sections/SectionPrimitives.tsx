'use client';

import { ReactNode } from 'react';
import clsx from 'clsx';

interface SectionIntroProps {
  description: ReactNode;
}

export function SectionIntro({ description }: SectionIntroProps) {
  return <div className="section-intro">{description}</div>;
}

interface SectionBlockProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  muted?: boolean;
}

export function SectionBlock({
  title,
  description,
  actions,
  children,
  muted = false,
}: SectionBlockProps) {
  return (
    <section className={muted ? 'section-block-muted' : 'section-block'}>
      {(title || description || actions) && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h3 className="section-block-title">{title}</h3>}
            {description && <p className="section-block-description">{description}</p>}
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

interface SectionFieldHeaderProps {
  label: ReactNode;
  action?: ReactNode;
}

export function SectionFieldHeader({ label, action }: SectionFieldHeaderProps) {
  return (
    <div className="mb-1 flex items-center justify-between gap-3">
      <label className="form-label mb-0">{label}</label>
      {action}
    </div>
  );
}

interface SectionCalloutProps {
  tone?: 'info' | 'warning' | 'success' | 'subtle';
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

export function SectionCallout({
  tone = 'subtle',
  title,
  children,
  actions,
}: SectionCalloutProps) {
  return (
    <div
      className={clsx('section-callout', {
        'section-callout-info': tone === 'info',
        'section-callout-warning': tone === 'warning',
        'section-callout-success': tone === 'success',
        'section-callout-subtle': tone === 'subtle',
      })}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {title && <p className="text-sm font-semibold">{title}</p>}
          <div className={clsx('text-sm', title && 'mt-1')}>{children}</div>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

interface SectionAddButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
}

export function SectionAddButton({
  children,
  onClick,
  type = 'button',
}: SectionAddButtonProps) {
  return (
    <button type={type} onClick={onClick} className="section-add-button">
      {children}
    </button>
  );
}

interface SectionIconButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  ariaLabel?: string;
}

export function SectionIconButton({
  children,
  onClick,
  disabled,
  tone = 'default',
  ariaLabel,
}: SectionIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={clsx(
        'section-icon-button',
        tone === 'danger' && 'section-icon-button-danger',
      )}
    >
      {children}
    </button>
  );
}
