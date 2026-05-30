'use client';

import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  useAuthHasHydrated,
  useAuthIsAuthenticated,
  useAuthLogin,
  useAuthLogout,
  useAuthUser,
} from '@/stores/auth-store';
import { api } from '@/lib/api';
import { feedbackCopy, notify } from '@/lib/notify';
import { shouldPreserveLocalSessionOnBootstrapError } from '@/lib/session-bootstrap';
import { useSessionTimeout } from '@/lib/useSessionTimeout';
import { useServerSessionCheck } from '@/lib/useServerSessionCheck';
import { FiList, FiShield } from 'react-icons/fi';
import type { NavItem } from './DashboardSidebar';
import { useDashboardSearch } from './useDashboardSearch';
import { clearAuthSessionPrefill, consumeAuthSessionPrefill, toAuthUser } from '@/lib/auth-session';
import { buildLoginRedirectPath, getCurrentAppPath } from '@/lib/login-redirect';
import DashboardLayoutShell from './DashboardLayoutShell';
import { DashboardBootstrapShell } from './DashboardBootstrapShell';
import {
  primaryNavigation,
  clinicalAnalyticsNavigation,
  secondaryNavigation,
} from './dashboard-nav.constants';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DASHBOARD_SIDEBAR_COLLAPSED_KEY = 'anamneo:dashboard-sidebar-collapsed';
const DEFAULT_SESSION_INACTIVITY_TIMEOUT_MINUTES = 15;

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthUser();
  const isAuthenticated = useAuthIsAuthenticated();
  const hasHydrated = useAuthHasHydrated();
  const login = useAuthLogin();
  const logout = useAuthLogout();
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

  useSessionTimeout(() => {
    notify.info(feedbackCopy.sessionExpiresSoon);
  }, inactivityTimeoutMs);

  useServerSessionCheck(() => {
    clearAuthSessionPrefill();
    logout({ clearLocalState: true });
    router.replace('/login?reason=session_expired');
  });

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

  const auditIntegrityQuery = useQuery({
    queryKey: ['audit-integrity-latest'],
    queryFn: async () =>
      (await api.get('/audit/integrity/latest')).data as { valid: boolean } | null,
    enabled: !!user?.isAdmin,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const auditBadge: NavItem['badge'] = user?.isAdmin
    ? auditIntegrityQuery.data == null
      ? undefined
      : auditIntegrityQuery.data.valid
        ? { variant: 'green', label: 'OK' }
        : { variant: 'red', label: '!' }
    : undefined;

  const secondaryItems: NavItem[] = [
    ...(isOperationalAdmin
      ? secondaryNavigation.filter((item) => item.href !== '/plantillas')
      : secondaryNavigation),
    ...(user?.isAdmin
      ? [
          { name: 'Admin', href: '/admin/usuarios', icon: FiShield },
          { name: 'Auditoría', href: '/admin/auditoria', icon: FiList, badge: auditBadge },
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

  const shortcutHint = useMemo(() => {
    if (typeof navigator === 'undefined') return '⌘K';
    return /mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl+K';
  }, []);

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
    if (!mounted || !hasHydrated || authCheckComplete) return;

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
            notify.error('No se pudo validar la sesión por un problema de red. Se conserva temporalmente la sesión local.');
          }
        } else if (axios.isAxiosError(error) && error.response?.status === 401) {
          logout();
        } else {
          logout();
        }
      } finally {
        if (!cancelled) setAuthCheckComplete(true);
      }
    };

    void bootstrapSession();
    return () => { cancelled = true; };
  }, [authCheckComplete, hasHydrated, isAuthenticated, login, logout, mounted]);

  useEffect(() => {
    if (!mounted || !hasHydrated || !authCheckComplete || isAuthenticated) return;
    router.replace(buildLoginRedirectPath(getCurrentAppPath(window.location)));
  }, [authCheckComplete, hasHydrated, isAuthenticated, mounted, router]);

  const openDashboardSearch = useCallback(() => {
    search.setSearchOpen(true);
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    const shouldExpandSidebar = isDesktop && sidebarCollapsed;
    if (shouldExpandSidebar) updateSidebarCollapsed(false);
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
    return <DashboardBootstrapShell />;
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
      showCollapseToggle={false}
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
