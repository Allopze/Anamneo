'use client';

import { AlertBanner } from './AlertBanner';

export function ErrorAlert(props: { message: string; title?: string }) {
  const { message, title } = props;

  return (
    <AlertBanner
      variant="error"
      title={title}
      message={<p className="whitespace-pre-line">{message}</p>}
    />
  );
}
