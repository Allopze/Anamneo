'use client';

import { ReactNode } from 'react';
import clsx from 'clsx';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';

interface AuthChip {
  icon: ReactNode;
  label: string;
}

interface AuthFrameProps {
  eyebrow: string;
  title: string;
  chips: AuthChip[];
  children: ReactNode;
  cardEyebrow: string;
  cardTitle: string;
  cardDescription?: string;
  footer: ReactNode;
  className?: string;
}

export function AuthFrame({
  eyebrow,
  title,
  chips,
  children,
  cardEyebrow,
  cardTitle,
  cardDescription,
  footer,
  className,
}: AuthFrameProps) {
  return (
    <div className="auth-shell">
      <aside className="auth-hero">
        <div className="auth-hero-panel">
          <AnamneoLogo
            className="mb-6 hidden lg:flex"
            iconClassName="h-10 w-10"
            textClassName="text-2xl font-bold text-ink-onDark"
            priority
          />

          <p className="auth-kicker">{eyebrow}</p>
          <h1 className="auth-headline">{title}</h1>

          <div className="auth-chip-band">
            {chips.map((chip) => (
              <span key={chip.label} className="auth-chip">
                {chip.icon}
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </aside>

      <main className="auth-panel">
        <div className={clsx('auth-card', className)}>
          <div className="auth-card-header">
            <AnamneoLogo
              className="justify-center lg:hidden"
              iconClassName="h-10 w-10"
              textClassName="text-2xl font-bold text-ink-primary"
              priority
            />

            <p className="auth-card-kicker">{cardEyebrow}</p>
            <h2 className="auth-card-title">{cardTitle}</h2>
            {cardDescription && <p className="auth-card-description">{cardDescription}</p>}
          </div>

          {children}

          <div className="auth-card-footer">{footer}</div>
        </div>
      </main>
    </div>
  );
}
