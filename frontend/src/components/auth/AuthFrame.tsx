'use client';

import { ReactNode } from 'react';
import clsx from 'clsx';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';

interface AuthFeature {
  label: string;
  title: string;
  description: string;
}

interface AuthFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  features: AuthFeature[];
  children: ReactNode;
  cardEyebrow: string;
  cardTitle: string;
  cardDescription: string;
  footer: ReactNode;
  heroFootnote?: string;
  className?: string;
}

export function AuthFrame({
  eyebrow,
  title,
  description,
  features,
  children,
  cardEyebrow,
  cardTitle,
  cardDescription,
  footer,
  heroFootnote,
  className,
}: AuthFrameProps) {
  return (
    <div className="auth-shell">
      <aside className="auth-hero">
        <div className="auth-hero-panel">
          <AnamneoLogo
            className="mb-8 hidden lg:flex"
            iconClassName="h-12 w-12"
            textClassName="text-3xl font-bold text-ink-onDark"
            priority
          />

          <p className="auth-kicker">{eyebrow}</p>
          <h1 className="auth-headline">{title}</h1>
          <p className="auth-copy">{description}</p>

          <div className="auth-feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="auth-feature-card">
                <p className="auth-feature-label">{feature.label}</p>
                <h2 className="auth-feature-title">{feature.title}</h2>
                <p className="auth-feature-description">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>

        {heroFootnote ? <p className="auth-footnote">{heroFootnote}</p> : null}
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
            <p className="auth-card-description">{cardDescription}</p>
          </div>

          {children}

          <div className="auth-card-footer">{footer}</div>
        </div>
      </main>
    </div>
  );
}
