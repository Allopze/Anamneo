'use client';

import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';
import { shouldPreserveLocalSessionOnBootstrapError } from '@/lib/session-bootstrap';
import { useSessionTimeout } from '@/lib/useSessionTimeout';
import toast from 'react-hot-toast';
import {
  FiActivity,
  FiHome,
  FiUsers,
  FiFileText,
  FiList,
  FiSettings,
  FiShield,
  FiLogOut,
  FiMenu,
  FiX,
  FiBookmark,
  FiClipboard,
  FiChevronsLeft,
  FiChevronsRight,
} from 'react-icons/fi';
import clsx from 'clsx';
import OfflineBanner from '@/components/common/OfflineBanner';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';
import Tooltip from '@/components/common/Tooltip';
import SmartHeaderBar from './SmartHeaderBar';
import { HeaderBarSlotContext } from './HeaderBarSlotContext';
import DashboardSidebar from './DashboardSidebar';
import type { NavItem } from './DashboardSidebar';
import MobileSearchOverlay from './MobileSearchOverlay';
import { useDashboardSearch } from './useDashboardSearch';
import { clearAuthSessionPrefill, consumeAuthSessionPrefill, toAuthUser } from '@/lib/auth-session';
import { buildLoginRedirectPath, getCurrentAppPath } from '@/lib/login-redirect';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const primaryNavigation: NavItem[] = [
  { name: 'Inicio', href: '/', icon: FiHome, exact: true },
  { name: 'Pacientes', href: '/pacientes', icon: FiUsers },
  { name: 'Atenciones', href: '/atenciones', icon: FiFileText },
  { name: 'Seguimientos', href: '/seguimientos', icon: FiClipboard },
];

const clinicalAnalyticsNavigation: NavItem = {
  name: 'Analítica clínica',
  href: '/analitica-clinica',
  icon: FiActivity,
};

const secondaryNavigation: NavItem[] = [
  { name: 'Catálogo', href: '/catalogo', icon: FiList },
  { name: 'Plantillas', href: '/plantillas', icon: FiBookmark },
  { name: 'Ajustes', href: '/ajustes', icon: FiSettings },
];

const DASHBOARD_SIDEBAR_COLLAPSED_KEY = 'anamneo:dashboard-sidebar-collapsed';
const DEFAULT_SESSION_INACTIVITY_TIMEOUT_MINUTES = 15;

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, hasHydrated, login, logout } = useAuthStore();
  const sessionPolicyQuery = useQuery({
    queryKey: ['settings', 'session-policy'],
    queryFn: async () =>
      (await api.get('/settings/session-policy')).data as {
        inactivityTimeoutMinutes: number;
      },
    enabled: hasHydrated && isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const inactivityTimeoutMs =
    (sessionPolicyQuery.data?.inactivityTimeoutMinutes ?? DEFAULT_SESSION_INACTIVITY_TIMEOUT_MINUTES) * 60 * 1000;

  // ── Session inactivity timeout ─────────────────────────────────────
  useSessionTimeout(() => {
    toast('Su sesión expirará pronto por inactividad', { icon: '⏱️' });
  }, inactivityTimeoutMs);

  // ── Force password change redirect ─────────────────────────────────
  useEffect(() => {
    if (user?.mustChangePassword && pathname !== '/cambiar-contrasena') {
      router.replace('/cambiar-contrasena');
    }
  }, [user?.mustChangePassword, pathname, router]);

  const isOperationalAdmin = !!user?.isAdmin;
  const canAccessClinicalAnalytics = user?.role === 'MEDICO' && !user?.isAdmin;
  const primaryItems = isOperationalAdmin
    ? primaryNavigation.filter((item) => item.href === '/' || item.href === '/pacientes')
    : canAccessClinicalAnalytics
      ? [...primaryNavigation, clinicalAnalyticsNavigation]
      : primaryNavigation;
  const secondaryItems: NavItem[] = [
    ...(isOperationalAdmin
      ? secondaryNavigation.filter((item) => item.href !== '/plantillas')
      : secondaryNavigation),
    ...(user?.isAdmin
      ? [
          { name: 'Admin', href: '/admin/usuarios', icon: FiShield },
          { name: 'Auditoría', href: '/admin/auditoria', icon: FiList },
        ] as NavItem[]
      : []),
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerBarSlot, setHeaderBarSlot] = useState<ReactNode>(null);
  const headerBarSlotCtx = useMemo(() => ({ setHeaderBarSlot }), []);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const hasShownBootstrapWarningRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DASHBOARD_SIDEBAR_COLLAPSED_KEY) === '1';
  });
  const isEncounterWorkspace = /^\/atenciones\/[^/]+$/.test(pathname);

  const search = useDashboardSearch(isOperationalAdmin);

  // Platform-aware shortcut hint
  const shortcutHint = useMemo(() => {
    if (typeof navigator === 'undefined') return '⌘K';
    return /mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl+K';
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateSidebarCollapsed = useCallback((next: boolean) => {
    setSidebarCollapsed(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(DASHBOARD_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
    }
  }, []);

  useEffect(() => {
    if (!mounted || !hasHydrated || authCheckComplete) {
      return;
    }

    let cancelled = false;

    const bootstrapSession = async () => {
      const sessionPrefill = consumeAuthSessionPrefill();
      if (sessionPrefill) {
        if (cancelled) return;

        login(toAuthUser(sessionPrefill));
        setAuthCheckComplete(true);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        if (cancelled) return;

        login(toAuthUser(response.data));
      } catch (error) {
        if (cancelled) return;

        if (shouldPreserveLocalSessionOnBootstrapError(error) && isAuthenticated) {
          if (!hasShownBootstrapWarningRef.current) {
            hasShownBootstrapWarningRef.current = true;
            toast.error('No se pudo validar la sesión por un problema temporal de conexión. Se conserva la sesión local.');
          }
        } else if (axios.isAxiosError(error) && error.response?.status === 401) {
          logout();
        } else {
          logout();
        }
      } finally {
        if (!cancelled) {
          setAuthCheckComplete(true);
        }
      }
    };

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [authCheckComplete, hasHydrated, isAuthenticated, login, logout, mounted]);

  useEffect(() => {
    if (!mounted || !hasHydrated || !authCheckComplete || isAuthenticated) {
      return;
    }

    router.replace(buildLoginRedirectPath(getCurrentAppPath(window.location)));
  }, [authCheckComplete, hasHydrated, isAuthenticated, mounted, router]);

  // ── Cmd+K global shortcut ──────────────────────────────────────────
  const openDashboardSearch = useCallback(() => {
    search.setSearchOpen(true);

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    const shouldExpandSidebar = isDesktop && sidebarCollapsed;

    if (shouldExpandSidebar) {
      updateSidebarCollapsed(false);
    }

    window.setTimeout(() => {
      if (window.innerWidth >= 1024) {
        searchInputRef.current?.focus();
      } else {
        mobileSearchInputRef.current?.focus();
      }
    }, shouldExpandSidebar ? 220 : 100);
  }, [search, sidebarCollapsed, updateSidebarCollapsed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openDashboardSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openDashboardSearch]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Clear local state even if server call fails
    }
    clearAuthSessionPrefill();
    logout({ clearLocalState: true });
    router.replace('/login');
  };

  if (!mounted || !hasHydrated || !authCheckComplete || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-frame border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-pill focus:bg-frame-dark focus:text-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:shadow-elevated"
      >
        Saltar al contenido
      </a>
      <OfflineBanner />

      {/* ── App Shell — Sidebar + Content ─────────────────────── */}
      <div className="flex h-screen overflow-hidden">

        {/* ── Floating Sidebar (Desktop) ─────────────────────── */}
        <DashboardSidebar
          user={user}
          primaryItems={primaryItems}
          secondaryItems={secondaryItems}
          collapsed={sidebarCollapsed}
          isOperationalAdmin={isOperationalAdmin}
          searchQuery={search.searchQuery}
          searchOpen={search.searchOpen}
          searchResults={search.searchResults}
          searchLoading={search.searchLoading}
          searchActiveIndex={search.searchActiveIndex}
          shortcutHint={shortcutHint}
          showCollapseToggle={isEncounterWorkspace}
          onCollapsedChange={updateSidebarCollapsed}
          onSearchChange={search.handleSearchChange}
          onSearchOpen={openDashboardSearch}
          onSearchFocus={() => search.setSearchOpen(true)}
          onSearchNavigate={search.handleSearchNavigate}
          onSearchActiveIndexChange={search.setSearchActiveIndex}
          onSearchClose={search.closeSearch}
          onLogout={handleLogout}
          searchInputRef={searchInputRef}
        />

        {/* ── Main Content Area ───────────────────────────────── */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">

          {/* ── Mobile Header ─────────────────────────────────── */}
          <header className="lg:hidden bg-surface-elevated rounded-b-card shadow-soft flex items-center justify-between px-5 h-16 z-20 mx-2 mt-2 flex-shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <AnamneoLogo
                className="gap-2"
                iconClassName="h-6 w-6"
                textClassName="text-xl font-extrabold text-ink"
              />
            </Link>
            <div className="flex items-center gap-2">
              <button
                className="p-2 text-ink-secondary hover:text-ink"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
              >
                {mobileMenuOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
              </button>
            </div>
          </header>

          {/* Mobile nav accordion */}
          {mobileMenuOpen && (
            <nav className="lg:hidden bg-frame mx-2 rounded-card px-4 pb-3 pt-2 animate-fade-in" aria-label="Navegación móvil">
              <div className="flex flex-wrap gap-1.5">
                {[...primaryItems, ...secondaryItems].map((item) => {
                  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={clsx(
                        'flex items-center gap-3 px-3.5 py-2.5 rounded-pill text-sm font-bold transition-all duration-200',
                        isActive
                          ? 'bg-accent text-accent-text'
                          : 'text-white/60 hover:bg-white/[0.08] hover:text-white'
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
              <button
                onClick={handleLogout}
                className="mt-2 flex items-center gap-2 px-3.5 py-2.5 rounded-pill text-sm font-bold text-status-red hover:bg-status-red/10 transition-colors"
              >
                <FiLogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </nav>
          )}

          {/* ── KPI + Context Bar ─────────────────────────────── */}
          <HeaderBarSlotContext.Provider value={headerBarSlotCtx}>
            <div className="flex-1 overflow-auto">
              {!isEncounterWorkspace ? (
                <div className="px-3 pt-4 pb-2 lg:px-6">
                  <div className="flex items-stretch gap-3">
                    <Tooltip label={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'} side="bottom">
                      <button
                        type="button"
                        onClick={() => updateSidebarCollapsed(!sidebarCollapsed)}
                        className="hidden lg:flex min-h-[56px] shrink-0 aspect-square items-center justify-center self-stretch rounded-full border border-surface-muted/35 bg-surface-elevated text-ink-secondary shadow-soft transition-colors hover:border-frame/18 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20"
                        aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
                        aria-expanded={!sidebarCollapsed}
                      >
                        {sidebarCollapsed ? <FiChevronsRight className="h-4.5 w-4.5" /> : <FiChevronsLeft className="h-4.5 w-4.5" />}
                      </button>
                    </Tooltip>

                    <SmartHeaderBar
                      className="mx-0 mt-0 mb-0 min-h-[56px] min-w-0 flex-1"
                      onSearchOpen={openDashboardSearch}
                      contextSlot={headerBarSlot}
                    />
                  </div>
                </div>
              ) : null}

              {/* ── Page Content ───────────────────────────────────── */}
              <main
                id="main-content"
                className={clsx(
                  'min-h-full',
                  isEncounterWorkspace ? 'px-0 py-0' : 'px-3 pb-6 lg:px-6 lg:pb-8',
                )}
              >
                {children}
              </main>
            </div>
          </HeaderBarSlotContext.Provider>
        </div>
      </div>

      {/* ── Mobile Search Overlay ─────────────────────────────── */}
      {search.searchOpen && !isOperationalAdmin && (
        <MobileSearchOverlay
          searchQuery={search.searchQuery}
          searchResults={search.searchResults}
          searchLoading={search.searchLoading}
          searchActiveIndex={search.searchActiveIndex}
          inputRef={mobileSearchInputRef}
          onSearchChange={search.handleSearchChange}
          onSearchNavigate={search.handleSearchNavigate}
          onActiveIndexChange={search.setSearchActiveIndex}
          onClose={search.closeSearch}
        />
      )}
    </div>
  );
}
