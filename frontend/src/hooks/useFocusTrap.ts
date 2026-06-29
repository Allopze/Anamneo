'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'details > summary',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
    (el) => !el.closest('[inert]') && el.offsetParent !== null,
  );
}

interface UseFocusTrapOptions {
  isOpen: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
  /** When true, Escape key is ignored (e.g. during loading/submitting). */
  disableEscape?: boolean;
}

/**
 * Traps keyboard focus inside `containerRef` when `isOpen` is true.
 * Saves the previously focused element and restores it when the trap is released.
 * Calls `onEscape` when Escape is pressed (unless `disableEscape` is true).
 */
export function useFocusTrap({
  isOpen,
  containerRef,
  initialFocusRef,
  onEscape,
  disableEscape = false,
}: UseFocusTrapOptions): void {
  const previousFocusRef = useRef<Element | null>(null);

  // Trap Tab/Shift-Tab within the container and set initial focus on open.
  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    // Save the element that had focus before opening.
    previousFocusRef.current = document.activeElement;

    // Set initial focus after the next paint so the container is fully rendered.
    const timer = setTimeout(() => {
      const target = initialFocusRef?.current ?? getFocusableElements(container)[0];
      target?.focus();
    }, 20);

    function handleKeyDown(e: KeyboardEvent) {
      if (!containerRef.current) return;

      if (e.key === 'Escape') {
        if (!disableEscape) {
          onEscape?.();
        }
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements(containerRef.current);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, containerRef, initialFocusRef, onEscape, disableEscape]);

  // Restore focus to the previously focused element when closing.
  useEffect(() => {
    if (isOpen) return;
    const prev = previousFocusRef.current;
    if (prev && 'focus' in prev) {
      // Defer slightly so the DOM has time to settle after close animation.
      setTimeout(() => {
        (prev as HTMLElement).focus({ preventScroll: true });
      }, 20);
    }
  }, [isOpen]);
}
