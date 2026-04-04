'use client';

import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';

export function ErrorAlert(props: { message: string; title?: string }) {
  const { message, title } = props;

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-status-red/30 bg-status-red/10 p-4"
      role="alert"
      aria-live="polite"
    >
      <FiAlertCircle className="w-5 h-5 text-status-red flex-shrink-0 mt-0.5" />
      <div>
        {title && <p className="text-sm font-semibold text-red-800 mb-1">{title}</p>}
        <p className="text-sm text-status-red whitespace-pre-line">{message}</p>
      </div>
    </div>
  );
}
