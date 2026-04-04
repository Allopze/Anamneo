'use client';

import { useState, useRef, useEffect, useCallback, useId } from 'react';
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
      aria-describedby={visible ? tooltipId : undefined}
    >
      {children}
      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={clsx(
            'tooltip-bubble absolute z-50 whitespace-nowrap',
            positionClasses[side],
            className
          )}
        >
          {label}
        </div>
      )}
    </div>
  );
}
