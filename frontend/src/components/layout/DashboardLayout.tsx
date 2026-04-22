'use client';

import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  FiClipboard,
  FiList,
  FiSettings,
  FiShield,
  FiBookmark,
} from 'react-icons/fi';
import type { NavItem } from './DashboardSidebar';
import { useDashboardSearch } from './useDashboardSearch';
import { clearAuthSessionPrefill, consumeAuthSessionPrefill, toAuthUser } from '@/lib/auth-session';
import { buildLoginRedirectPath, getCurrentAppPath } from '@/lib/login-redirect';
import DashboardLayoutShell from './DashboardLayoutShell';

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
            toast.error('No se pudo validar la sesión por un problema de red. Se conserva temporalmente la sesión local.');
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
    <DashboardLayoutShell
      user={user}
      pathname={pathname}
      primaryItems={primaryItems}
      secondaryItems={secondaryItems}
      isOperationalAdmin={isOperationalAdmin}
      isEncounterWorkspace={isEncounterWorkspace}
      sidebarCollapsed={sidebarCollapsed}
      shortcutHint={shortcutHint}
      mobileMenuOpen={mobileMenuOpen}
      headerBarSlot={headerBarSlot}
      setHeaderBarSlot={setHeaderBarSlot}
      searchQuery={search.searchQuery}
      searchOpen={search.searchOpen}
      searchResults={search.searchResults}
      searchLoading={search.searchLoading}
      searchActiveIndex={search.searchActiveIndex}
      showCollapseToggle={isEncounterWorkspace}
      searchInputRef={searchInputRef}
      mobileSearchInputRef={mobileSearchInputRef}
      onCollapsedChange={updateSidebarCollapsed}
      onMobileMenuToggle={setMobileMenuOpen}
      onSearchChange={search.handleSearchChange}
      onSearchOpen={openDashboardSearch}
      onSearchFocus={() => search.setSearchOpen(true)}
      onSearchNavigate={search.handleSearchNavigate}
      onSearchActiveIndexChange={search.setSearchActiveIndex}
      onSearchClose={search.closeSearch}
      onLogout={handleLogout}
    >
      {children}
    </DashboardLayoutShell>
  );
}
