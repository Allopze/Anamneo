'use client';

import Link from 'next/link';
import { FiChevronRight, FiPlus, FiUsers } from 'react-icons/fi';
import { getFirstName } from '@/lib/utils';
import DashboardOperationalChecks from './DashboardOperationalChecks';
import {
  ADMIN_CARDS,
  type DashboardData,
  getGreeting,
  sectionAnimation,
} from './dashboard.constants';

interface DashboardAdminViewProps {
  user: { nombre?: string } | null;
}

export default function DashboardAdminView({ user }: DashboardAdminViewProps) {
  return (
    <div className="space-y-6 pb-2">
      <section
        className="animate-fade-in rounded-card bg-surface-elevated px-6 py-8 shadow-soft lg:px-10 lg:py-10"
        style={sectionAnimation(0)}
      >
        <h1 className="text-[2rem] font-extrabold tracking-tight text-ink sm:text-[2.4rem]">
          {getGreeting()}, {getFirstName(user?.nombre)}
        </h1>
        <p className="mt-2 max-w-2xl text-base text-ink-secondary">
          Panel operativo — gestiona usuarios, auditoría, catálogo y el registro administrativo de pacientes.
        </p>
      </section>

      <section className="animate-fade-in" style={sectionAnimation(30)}>
        <DashboardOperationalChecks />
      </section>

      <section
        className="animate-fade-in grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        style={sectionAnimation(60)}
      >
        {ADMIN_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-start gap-4 rounded-card bg-surface-elevated p-5 shadow-soft transition-[background-color,box-shadow] hover:bg-surface-inset/50 hover:shadow-md"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-inset text-ink-secondary transition-colors group-hover:bg-accent/20 group-hover:text-accent-text">
              <card.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-ink">{card.label}</h2>
              <p className="mt-1 text-sm text-ink-secondary">{card.description}</p>
            </div>
            <FiChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink" />
          </Link>
        ))}
      </section>
    </div>
  );
}
