import Link from 'next/link';
import type { ReactNode } from 'react';
import { FiArrowLeft, FiShield } from 'react-icons/fi';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';

interface DataRightsRequestShellProps {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  helper: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function DataRightsRequestShell({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  helper,
  children,
  footer,
}: DataRightsRequestShellProps) {
  return (
    <main className="portal-page">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="portal-external-topbar">
          <Link href={backHref} className="portal-icon-button" aria-label={backLabel}>
            <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <AnamneoLogo
            className="gap-2"
            iconClassName="h-9 w-9 text-ink"
            textClassName="auth-logo-text-on-light text-2xl"
            priority
            inlineIcon
          />
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.2fr)] lg:items-start">
          <aside className="portal-card space-y-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-auth-teal/12 text-auth-teal">
              <FiShield className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-auth-teal">{eyebrow}</p>
              <h1 className="portal-title mt-2">{title}</h1>
              <p className="portal-copy mt-3">{description}</p>
            </div>
            <p className="rounded-lg bg-surface-inset p-3 text-xs leading-5 text-ink-muted">
              {helper}
            </p>
          </aside>

          <section className="portal-card">
            {children}
          </section>
        </div>

        {footer ? (
          <footer className="portal-card text-xs leading-5 text-ink-muted">
            {footer}
          </footer>
        ) : null}
      </div>
    </main>
  );
}
