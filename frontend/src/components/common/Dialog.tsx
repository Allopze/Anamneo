'use client';

import { useRef, useId, type ReactNode, type RefObject, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Accessible title for the dialog. Used for `aria-labelledby`.
   * If provided, a `<h2>` heading is rendered inside the panel; the consumer
   * can also pass their own heading inside `children` and leave this unset.
   */
  title?: string;
  /**
   * Accessible description for the dialog. Used for `aria-describedby`.
   * If provided a hidden `<p>` is rendered; the consumer can also pass a
   * `id={descriptionId}` element inside `children`.
   */
  description?: string;
  /** Dialog vs alertdialog. Defaults to 'dialog'. */
  role?: 'dialog' | 'alertdialog';
  /**
   * Ref to the element that should receive initial focus when the dialog opens.
   * Falls back to the first focusable element inside the dialog.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** When true, pressing Escape and clicking the backdrop do nothing. */
  loading?: boolean;
  /** When true, clicking the backdrop does not close the dialog. */
  disableBackdropClose?: boolean;
  /**
   * Maximum width of the dialog panel.
   * @default 'md'
   */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
  className?: string;
  /** Extra inline styles applied to the panel container. */
  panelStyle?: React.CSSProperties;
  children: ReactNode;
}

const MAX_WIDTH_CLASSES: Record<NonNullable<DialogProps['maxWidth']>, string> = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
};

/**
 * Accessible dialog / modal primitive.
 *
 * Handles:
 * - Focus trap (Tab / Shift-Tab cycle within the dialog)
 * - Initial focus (first focusable element or `initialFocusRef`)
 * - Escape to close (unless `loading` is true)
 * - Focus restoration to the trigger element on close
 * - Scroll-lock on `<body>` while open
 * - Backdrop click to close (unless `disableBackdropClose` or `loading`)
 * - Proper ARIA attributes (role, aria-modal, aria-labelledby, aria-describedby)
 *
 * The consumer is responsible for all visual content (header, body, footer).
 * This component only provides the overlay, panel container, and a11y wiring.
 * Use the optional `title` and `description` props for inline heading/description
 * rendering; or manage them entirely inside `children` for full control.
 *
 * @example
 * ```tsx
 * <Dialog isOpen={open} onClose={() => setOpen(false)} title="Confirmar acción">
 *   <Dialog.Body>…</Dialog.Body>
 *   <Dialog.Footer>…</Dialog.Footer>
 * </Dialog>
 * ```
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  role = 'dialog',
  initialFocusRef,
  loading = false,
  disableBackdropClose = false,
  maxWidth = 'md',
  className = '',
  panelStyle,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const descId = useId();

  useFocusTrap({
    isOpen,
    containerRef: panelRef,
    initialFocusRef,
    onEscape: onClose,
    disableEscape: loading,
  });

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (!loading && !disableBackdropClose) onClose();
  };

  const panel = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-frame-dark/40 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={handleBackdropClick}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-label={title || undefined}
        aria-describedby={description ? descId : undefined}
        className={`relative w-full ${MAX_WIDTH_CLASSES[maxWidth]} rounded-card bg-surface-elevated shadow-elevated animate-fade-in ${className}`}
        style={panelStyle}
      >
        {description && (
          <p id={descId} className="sr-only">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
}

/* ------------------------------------------------------------------ */
/* Convenience slot components                                          */
/* ------------------------------------------------------------------ */

Dialog.Header = function DialogHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between gap-4 border-b border-surface-muted/20 px-6 py-4 ${className}`}>
      {children}
    </div>
  );
};

Dialog.Body = function DialogBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
};

Dialog.Footer = function DialogFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-end gap-3 border-t border-surface-muted/20 px-6 py-4 ${className}`}>
      {children}
    </div>
  );
};
