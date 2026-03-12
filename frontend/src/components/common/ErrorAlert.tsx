'use client';

import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';

export function ErrorAlert(props: { message: string; title?: string }) {
  const { message, title } = props;

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
      <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div>
        {title && <p className="text-sm font-semibold text-red-800 mb-1">{title}</p>}
        <p className="text-sm text-red-700 whitespace-pre-line">{message}</p>
      </div>
    </div>
  );
}
