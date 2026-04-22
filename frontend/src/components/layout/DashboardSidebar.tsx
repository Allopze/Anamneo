'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiLogOut } from 'react-icons/fi';
import clsx from 'clsx';
import { getNameInitial } from '@/lib/utils';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';
import Tooltip from '@/components/common/Tooltip';
import type { IconType } from 'react-icons';
import { SidebarCollapseButton, SidebarNavItem } from './DashboardSidebarParts';
import { DashboardSidebarSearch } from './DashboardSidebarSearch';

export interface NavItem {
  name: string;
  href: string;
  icon: IconType;
  exact?: boolean;
}

interface DashboardSidebarProps {
  user: { nombre?: string; isAdmin?: boolean; role?: string } | null;
  primaryItems: NavItem[];
  secondaryItems: NavItem[];
  collapsed: boolean;
  isOperationalAdmin: boolean;
  searchQuery: string;
  searchOpen: boolean;
  searchResults: Array<{ id: string; type: 'patient' | 'encounter'; title: string; subtitle: string; href: string }>;
  searchLoading: boolean;
  searchActiveIndex: number;
  shortcutHint: string;
  showCollapseToggle: boolean;
  onCollapsedChange: (next: boolean) => void;
  onSearchChange: (value: string) => void;
  onSearchOpen: () => void;
  onSearchFocus: () => void;
  onSearchNavigate: (href: string) => void;
  onSearchActiveIndexChange: (index: number) => void;
  onSearchClose: () => void;
  onLogout: () => void;
  searchInputRef: React.Ref<HTMLInputElement>;
}

export default function DashboardSidebar({
  user,
  primaryItems,
  secondaryItems,
  collapsed,
  isOperationalAdmin,
  searchQuery,
  searchOpen,
  searchResults,
  searchLoading,
  searchActiveIndex,
  shortcutHint,
  showCollapseToggle,
  onCollapsedChange,
  onSearchChange,
  onSearchOpen,
  onSearchFocus,
  onSearchNavigate,
  onSearchActiveIndexChange,
  onSearchClose,
  onLogout,
  searchInputRef,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const userRoleLabel = user?.isAdmin ? 'Administrador' : user?.role === 'MEDICO' ? 'Médico' : 'Asistente';

  return (
    <div className={clsx('relative hidden lg:flex flex-shrink-0 py-4 pr-3', showCollapseToggle ? 'pl-7' : 'pl-4')}>
      {showCollapseToggle ? (
        <SidebarCollapseButton collapsed={collapsed} onToggle={() => onCollapsedChange(!collapsed)} />
      ) : null}

      <aside
        className={clsx(
          'z-10 flex flex-col rounded-shell bg-frame shadow-elevated transition-[width] duration-200',
          collapsed ? 'w-[76px]' : 'w-[236px]',
        )}
        style={{ overflow: 'clip' }}
      >
        <div className={clsx('flex h-24 items-center', collapsed ? 'justify-center px-3' : 'px-7')}>
          <Link href="/" className="flex items-center" aria-label="Inicio — Anamneo">
            <AnamneoLogo
              className={clsx(collapsed ? 'justify-center gap-0' : 'gap-2')}
              iconClassName={clsx('brightness-0 invert', collapsed ? 'h-9 w-9' : 'h-8 w-8')}
              textClassName={clsx('text-2xl font-extrabold text-white tracking-tight', collapsed && 'hidden')}
            />
          </Link>
        </div>

        <div className={clsx('border-b border-white/20', collapsed ? 'mb-3 px-3 pb-4' : 'mb-4 px-4 pb-5')}>
          {collapsed ? (
            <div className="flex justify-center">
              <Tooltip label={`${user?.nombre ?? 'Usuario'} · ${userRoleLabel}`} side="right">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-inset text-base font-bold text-frame">
                  {getNameInitial(user?.nombre)}
                </div>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-card bg-frame-dark p-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-surface-inset text-lg font-bold text-frame">
                {getNameInitial(user?.nombre)}
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="truncate text-sm font-bold text-white" title={user?.nombre}>{user?.nombre}</p>
                <p className="truncate text-xs font-medium capitalize text-white/50">
                  {userRoleLabel}
                </p>
              </div>
            </div>
          )}
        </div>

        {!isOperationalAdmin ? (
          <DashboardSidebarSearch
            collapsed={collapsed}
            shortcutHint={shortcutHint}
            searchQuery={searchQuery}
            searchOpen={searchOpen}
            searchResults={searchResults}
            searchLoading={searchLoading}
            searchActiveIndex={searchActiveIndex}
            onSearchChange={onSearchChange}
            onSearchOpen={onSearchOpen}
            onSearchFocus={onSearchFocus}
            onSearchNavigate={onSearchNavigate}
            onSearchActiveIndexChange={onSearchActiveIndexChange}
            onSearchClose={onSearchClose}
            searchInputRef={searchInputRef}
          />
        ) : null}

        <nav
          className={clsx(
            'sidebar-scroll flex-1 overflow-y-auto',
            collapsed ? 'space-y-2 px-2 py-2' : 'space-y-1.5 px-4 py-2',
          )}
          aria-label="Navegación principal"
        >
          {primaryItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <SidebarNavItem key={item.name} item={item} isActive={isActive} collapsed={collapsed} />
            );
          })}

          <div className={clsx('border-t border-white/[0.12]', collapsed ? 'mx-1 my-2' : 'mx-2 my-3')} />

          {secondaryItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <SidebarNavItem key={item.name} item={item} isActive={isActive} collapsed={collapsed} />
            );
          })}
        </nav>

        <div className={clsx(collapsed ? 'p-3 pt-2' : 'p-6')}>
          {collapsed ? (
            <div className="flex justify-center">
              <Tooltip label="Salir" side="right">
                <button
                  onClick={onLogout}
                  className="flex h-11 w-11 items-center justify-center rounded-card bg-frame-dark text-white/55 transition-colors hover:bg-status-red hover:text-white"
                  aria-label="Salir"
                >
                  <FiLogOut className="h-4.5 w-4.5" />
                </button>
              </Tooltip>
            </div>
          ) : (
            <button
              onClick={onLogout}
              className="flex w-full items-center justify-center rounded-pill bg-frame-dark px-4 py-3 text-sm font-bold text-white/50 transition-colors hover:bg-status-red hover:text-white"
            >
              <FiLogOut className="mr-3 h-5 w-5" />
              Salir
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
