'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RedirectNotice } from './RedirectNotice';

interface RouteAccessGateProps {
  when: boolean;
  href: string;
  title: string;
  description: string;
  actionLabel: string;
}

export function RouteAccessGate({
  when,
  href,
  title,
  description,
  actionLabel,
}: RouteAccessGateProps) {
  const router = useRouter();

  useEffect(() => {
    if (!when) {
      return;
    }

    const navigate =
      typeof router.replace === 'function'
        ? router.replace.bind(router)
        : typeof router.push === 'function'
          ? router.push.bind(router)
          : null;

    navigate?.(href);
  }, [href, router, when]);

  if (!when) {
    return null;
  }

  return (
    <RedirectNotice
      title={title}
      description={description}
      href={href}
      actionLabel={actionLabel}
    />
  );
}
