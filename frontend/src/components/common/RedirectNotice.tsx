'use client';

import Link from 'next/link';

interface RedirectNoticeProps {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

export function RedirectNotice({ title, description, href, actionLabel }: RedirectNoticeProps) {
  return (
    <div className="animate-fade-in py-10">
      <div className="card max-w-xl">
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-secondary">{description}</p>
        <Link href={href} className="btn btn-secondary mt-4 inline-flex items-center gap-2">
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}
