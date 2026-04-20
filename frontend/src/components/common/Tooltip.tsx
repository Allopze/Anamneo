'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  /** Where the tooltip appears relative to the trigger */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Extra classes on the tooltip bubble */
  className?: string;
  /** Delay before showing (ms) */
  delayMs?: number;
}

export default function Tooltip({
  label,
  children,
  side = 'bottom',
  className,
  delayMs = 400,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const tooltipId = `tooltip-${id}`;

  const show = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), delayMs);
  }, [delayMs]);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Don't hide if focus moves to another element inside the wrapper
      if (wrapperRef.current?.contains(e.relatedTarget as Node)) return;
      hide();
    },
    [hide],
  );

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current || !tooltipRef.current) return;

    const triggerRect = wrapperRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 10;
    const viewportPadding = 8;

    let top = 0;
    let left = 0;

    switch (side) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - gap;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + gap;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        break;
      case 'left':
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.left - tooltipRect.width - gap;
        break;
      case 'right':
      default:
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.right + gap;
        break;
    }

    const clampedTop = Math.min(
      window.innerHeight - tooltipRect.height - viewportPadding,
      Math.max(viewportPadding, top),
    );
    const clampedLeft = Math.min(
      window.innerWidth - tooltipRect.width - viewportPadding,
      Math.max(viewportPadding, left),
    );

    setPosition({ top: clampedTop, left: clampedLeft });
  }, [side]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!visible) {
      setPosition(null);
      return;
    }

    updatePosition();
  }, [visible, label, updatePosition]);

  useEffect(() => {
    if (!visible) return;

    const handleViewportChange = () => updatePosition();

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [visible, updatePosition]);

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={handleBlur}
      aria-describedby={visible ? tooltipId : undefined}
    >
      {children}
      {visible && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              data-side={side}
              className={clsx('tooltip-bubble fixed z-[80] whitespace-nowrap', className)}
              style={
                position
                  ? { top: position.top, left: position.left }
                  : { top: 0, left: 0, visibility: 'hidden' }
              }
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
