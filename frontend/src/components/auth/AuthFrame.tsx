'use client';

import { ReactNode } from 'react';
import clsx from 'clsx';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';

interface AuthChip {
  icon: ReactNode;
  label: string;
  description?: string;
}

interface AuthFrameProps {
  eyebrow: string;
  title: string;
  description?: string;
  chips: AuthChip[];
  children: ReactNode;
  cardEyebrow: string;
  cardTitle: string;
  cardDescription?: string;
  heroFooter?: ReactNode;
  footer: ReactNode;
  className?: string;
  logoIconClassName?: string;
  logoTextClassName?: string;
}

export function AuthFrame({
  eyebrow,
  title,
  description,
  chips,
  children,
  cardEyebrow,
  cardTitle,
  cardDescription,
  heroFooter,
  footer,
  className,
  logoIconClassName,
  logoTextClassName,
}: AuthFrameProps) {
  return (
    <div className="auth-shell">
      <aside className="auth-hero">
        <div className="auth-hero-panel">
          <AnamneoLogo
            className="mb-6 hidden lg:flex"
            iconClassName={clsx('h-12 w-12 text-white', logoIconClassName)}
            textClassName={clsx('auth-logo-text-on-dark text-2xl font-bold', logoTextClassName)}
            priority
            inlineIcon
          />

          <p className="auth-kicker">{eyebrow}</p>
          <h1 className="auth-headline">{title}</h1>
          {description ? <p className="auth-hero-description">{description}</p> : null}

          <div className="auth-chip-band" aria-label="Capacidades del sistema">
            {chips.map((chip) => (
              <div key={chip.label} className="auth-chip">
                <span className="auth-chip-icon">{chip.icon}</span>
                <span>
                  <span className="auth-chip-title">{chip.label}</span>
                  {chip.description ? <span className="auth-chip-copy">{chip.description}</span> : null}
                </span>
              </div>
            ))}
          </div>

          {heroFooter ? <div className="auth-hero-footer">{heroFooter}</div> : null}
        </div>
      </aside>

      <main className="auth-panel">
        <div className={clsx('auth-card', className)}>
          <div className="auth-card-header">
            <AnamneoLogo
              className="justify-center lg:hidden"
              iconClassName={clsx('h-12 w-12 text-ink-primary', logoIconClassName)}
              textClassName={clsx('auth-logo-text-on-light text-2xl font-bold', logoTextClassName)}
              priority
              inlineIcon
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
