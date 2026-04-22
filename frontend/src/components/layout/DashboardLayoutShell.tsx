'use client';

import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { FiChevronsLeft, FiChevronsRight, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import OfflineBanner from '@/components/common/OfflineBanner';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';
import Tooltip from '@/components/common/Tooltip';
import SmartHeaderBar from './SmartHeaderBar';
import { HeaderBarSlotContext } from './HeaderBarSlotContext';
import DashboardSidebar, { type NavItem } from './DashboardSidebar';
import MobileSearchOverlay from './MobileSearchOverlay';
import type { SearchResult } from './useDashboardSearch';

interface DashboardLayoutShellProps {
  children: ReactNode;
  user: { nombre?: string; isAdmin?: boolean; role?: string } | null;
  pathname: string;
  primaryItems: NavItem[];
  secondaryItems: NavItem[];
  isOperationalAdmin: boolean;
  isEncounterWorkspace: boolean;
  sidebarCollapsed: boolean;
  shortcutHint: string;
  mobileMenuOpen: boolean;
  headerBarSlot: ReactNode;
  setHeaderBarSlot: Dispatch<SetStateAction<ReactNode>>;
  searchQuery: string;
  searchOpen: boolean;
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchActiveIndex: number;
  showCollapseToggle: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  mobileSearchInputRef: RefObject<HTMLInputElement | null>;
  onCollapsedChange: (next: boolean) => void;
  onMobileMenuToggle: (next: boolean) => void;
  onSearchChange: (value: string) => void;
  onSearchOpen: () => void;
  onSearchFocus: () => void;
  onSearchNavigate: (href: string) => void;
  onSearchActiveIndexChange: (index: number) => void;
  onSearchClose: () => void;
  onLogout: () => void;
}

export default function DashboardLayoutShell({
  children,
  user,
  pathname,
  primaryItems,
  secondaryItems,
  isOperationalAdmin,
  isEncounterWorkspace,
  sidebarCollapsed,
  shortcutHint,
  mobileMenuOpen,
  headerBarSlot,
  setHeaderBarSlot,
  searchQuery,
  searchOpen,
  searchResults,
  searchLoading,
  searchActiveIndex,
  showCollapseToggle,
  searchInputRef,
  mobileSearchInputRef,
  onCollapsedChange,
  onMobileMenuToggle,
  onSearchChange,
  onSearchOpen,
  onSearchFocus,
  onSearchNavigate,
  onSearchActiveIndexChange,
  onSearchClose,
  onLogout,
}: DashboardLayoutShellProps) {
  return (
    <div className="min-h-screen bg-surface-base">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-pill focus:bg-frame-dark focus:text-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:shadow-elevated"
      >
        Saltar al contenido
      </a>
      <OfflineBanner />

      <div className="flex h-screen overflow-hidden">
        <DashboardSidebar
          user={user}
          primaryItems={primaryItems}
          secondaryItems={secondaryItems}
          collapsed={sidebarCollapsed}
          isOperationalAdmin={isOperationalAdmin}
          searchQuery={searchQuery}
          searchOpen={searchOpen}
          searchResults={searchResults as any}
          searchLoading={searchLoading}
          searchActiveIndex={searchActiveIndex}
          shortcutHint={shortcutHint}
          showCollapseToggle={showCollapseToggle}
          onCollapsedChange={onCollapsedChange}
          onSearchChange={onSearchChange}
          onSearchOpen={onSearchOpen}
          onSearchFocus={onSearchFocus}
          onSearchNavigate={onSearchNavigate}
          onSearchActiveIndexChange={onSearchActiveIndexChange}
          onSearchClose={onSearchClose}
          onLogout={onLogout}
          searchInputRef={searchInputRef as React.Ref<HTMLInputElement>}
        />

        <div className="relative flex h-full flex-1 flex-col overflow-hidden">
          <header className="z-20 mx-2 mt-2 flex h-16 flex-shrink-0 items-center justify-between rounded-b-card bg-surface-elevated px-5 shadow-soft lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <AnamneoLogo className="gap-2" iconClassName="h-6 w-6" textClassName="text-xl font-extrabold text-ink" />
            </Link>
            <div className="flex items-center gap-2">
              <button
                className="p-2 text-ink-secondary hover:text-ink"
                onClick={() => onMobileMenuToggle(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
              >
                {mobileMenuOpen ? <FiX className="h-5 w-5" /> : <FiMenu className="h-5 w-5" />}
              </button>
            </div>
          </header>

          {mobileMenuOpen ? (
            <nav className="mx-2 animate-fade-in rounded-card bg-frame px-4 pb-3 pt-2 lg:hidden" aria-label="Navegación móvil">
              <div className="flex flex-wrap gap-1.5">
                {[...primaryItems, ...secondaryItems].map((item) => {
                  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => onMobileMenuToggle(false)}
                      className={clsx(
                        'flex items-center gap-3 rounded-pill px-3.5 py-2.5 text-sm font-bold transition-all duration-200',
                        isActive
                          ? 'bg-accent text-accent-text'
                          : 'text-white/60 hover:bg-white/[0.08] hover:text-white',
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
              <button
                onClick={onLogout}
                className="mt-2 flex items-center gap-2 rounded-pill px-3.5 py-2.5 text-sm font-bold text-status-red transition-colors hover:bg-status-red/10"
              >
                <FiLogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </nav>
          ) : null}

          <HeaderBarSlotContext.Provider value={{ setHeaderBarSlot }}>
            <div className="flex-1 overflow-auto">
              {!isEncounterWorkspace ? (
                <div className="px-3 pb-2 pt-4 lg:px-6">
                  <div className="flex items-stretch gap-3">
                    <Tooltip label={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'} side="bottom">
                      <button
                        type="button"
                        onClick={() => onCollapsedChange(!sidebarCollapsed)}
                        className="hidden min-h-[56px] aspect-square shrink-0 items-center justify-center self-stretch rounded-full border border-surface-muted/35 bg-surface-elevated text-ink-secondary shadow-soft transition-colors hover:border-frame/18 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20 lg:flex"
                        aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
                        aria-expanded={!sidebarCollapsed}
                      >
                        {sidebarCollapsed ? <FiChevronsRight className="h-4.5 w-4.5" /> : <FiChevronsLeft className="h-4.5 w-4.5" />}
                      </button>
                    </Tooltip>

                    <SmartHeaderBar className="mx-0 mt-0 mb-0 min-h-[56px] min-w-0 flex-1" onSearchOpen={onSearchOpen} contextSlot={headerBarSlot} />
                  </div>
                </div>
              ) : null}

              <main
                id="main-content"
                className={clsx('min-h-full', isEncounterWorkspace ? 'px-0 py-0' : 'px-3 pb-6 lg:px-6 lg:pb-8')}
              >
                {children}
              </main>
            </div>
          </HeaderBarSlotContext.Provider>
        </div>
      </div>

      {searchOpen && !isOperationalAdmin ? (
        <MobileSearchOverlay
          searchQuery={searchQuery}
          searchResults={searchResults}
          searchLoading={searchLoading}
          searchActiveIndex={searchActiveIndex}
          inputRef={mobileSearchInputRef as React.Ref<HTMLInputElement>}
          onSearchChange={onSearchChange}
          onSearchNavigate={onSearchNavigate}
          onActiveIndexChange={onSearchActiveIndexChange}
          onClose={onSearchClose}
        />
      ) : null}
    </div>
  );
}