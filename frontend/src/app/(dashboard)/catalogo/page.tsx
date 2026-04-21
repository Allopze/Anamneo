'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FiPackage, FiTag } from 'react-icons/fi';
import ConditionsCatalogSection from './ConditionsCatalogSection';
import MedicationsCatalogSection from './MedicationsCatalogSection';

const CATALOG_TABS = [
  {
    key: 'afecciones',
    label: 'Afecciones',
    description: 'Diagnósticos y términos reutilizables para sugerencias clínicas.',
    href: '/catalogo?categoria=afecciones',
    icon: FiTag,
  },
  {
    key: 'medicamentos',
    label: 'Medicamentos',
    description: 'Catálogo global con nombre comercial o visible y su principio activo.',
    href: '/catalogo?categoria=medicamentos',
    icon: FiPackage,
  },
] as const;

export default function CatalogoPage() {
  const searchParams = useSearchParams();
  const category = searchParams.get('categoria') === 'medicamentos' ? 'medicamentos' : 'afecciones';
  const activeTab = CATALOG_TABS.find((tab) => tab.key === category) ?? CATALOG_TABS[0];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="page-header flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-header-title">Catálogo</h1>
          <p className="page-header-description">
            Base reutilizable para terminología clínica, apoyo a registro y cargas masivas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CATALOG_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === category;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={[
                  'inline-flex items-center gap-2 rounded-pill border px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
                  isActive
                    ? 'border-accent bg-accent text-accent-text shadow-soft'
                    : 'border-surface-muted/30 bg-surface-base text-ink-secondary hover:bg-surface-inset hover:text-ink hover:border-surface-muted',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card">
        <p className="text-sm text-ink-secondary">{activeTab.description}</p>
      </div>

      {category === 'medicamentos' ? <MedicationsCatalogSection /> : <ConditionsCatalogSection />}
    </div>
  );
}
