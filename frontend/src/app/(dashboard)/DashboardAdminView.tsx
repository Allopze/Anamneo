'use client';

import Link from 'next/link';
import { FiChevronRight } from 'react-icons/fi';
import { getFirstName } from '@/lib/utils';
import DashboardOperationalChecks from './DashboardOperationalChecks';
import {
  ADMIN_CARD_SECTIONS,
  getGreeting,
  sectionAnimation,
} from './dashboard.constants';

interface DashboardAdminViewProps {
  user: { nombre?: string } | null;
}

export default function DashboardAdminView({ user }: DashboardAdminViewProps) {
  return (
    <div className="space-y-3 pb-2">
      <section
        className="animate-fade-in rounded-card border border-surface-muted/45 bg-surface-elevated px-6 py-7 shadow-soft lg:px-10 lg:py-8"
        style={sectionAnimation(0)}
      >
        <h1 className="max-w-3xl text-[1.85rem] font-bold tracking-tight text-ink sm:text-[2.15rem]">
          {getGreeting()}, {getFirstName(user?.nombre)}
        </h1>
        <p className="mt-2 max-w-2xl text-base text-ink-secondary">
          Panel operativo — gestiona usuarios, auditoría, catálogo y el registro administrativo de pacientes.
        </p>
      </section>

      <section className="animate-fade-in" style={sectionAnimation(30)}>
        <DashboardOperationalChecks />
      </section>

      <div className="animate-fade-in space-y-8" style={sectionAnimation(60)}>
        {ADMIN_CARD_SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-3 text-sm font-semibold text-ink-muted">{section.heading}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {section.cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group flex items-start gap-4 rounded-card border border-surface-muted/45 bg-surface-elevated p-5 shadow-soft transition-[background-color,border-color,box-shadow] hover:border-frame/15 hover:bg-surface-inset/50 hover:shadow-card"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card border border-surface-muted/35 bg-surface-inset text-ink-secondary transition-colors group-hover:bg-accent/20 group-hover:text-accent-text">
                    <card.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-ink">{card.label}</h3>
                    <p className="mt-1 text-sm text-ink-secondary">{card.description}</p>
                  </div>
                  <FiChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
