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
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Catálogo</h1>
          <p className="page-header-description">
            Base reutilizable para terminología clínica, apoyo a registro y cargas masivas.
          </p>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap gap-2">
          {CATALOG_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === category;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={[
                  'inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition-colors',
                  isActive
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-surface-muted/30 bg-surface-base/40 text-ink-secondary hover:border-accent/40 hover:text-accent',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>
        <p className="text-sm text-ink-secondary">{activeTab.description}</p>
      </div>

      {category === 'medicamentos' ? <MedicationsCatalogSection /> : <ConditionsCatalogSection />}
    </div>
  );
}
