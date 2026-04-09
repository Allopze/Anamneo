'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';
import { useSessionTimeout } from '@/lib/useSessionTimeout';
import toast from 'react-hot-toast';
import {
  FiHome,
  FiUsers,
  FiFileText,
  FiList,
  FiSettings,
  FiShield,
  FiLogOut,
  FiMenu,
  FiX,
  FiSearch,
  FiBookmark,
  FiClipboard,
  FiArrowRight,
  FiUser,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import clsx from 'clsx';
import { getNameInitial } from '@/lib/utils';
import OfflineBanner from '@/components/common/OfflineBanner';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';
import SmartHeaderBar from './SmartHeaderBar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: IconType;
  exact?: boolean;
}

const primaryNavigation: NavItem[] = [
  { name: 'Inicio', href: '/', icon: FiHome, exact: true },
  { name: 'Pacientes', href: '/pacientes', icon: FiUsers },
  { name: 'Atenciones', href: '/atenciones', icon: FiFileText },
  { name: 'Seguimientos', href: '/seguimientos', icon: FiClipboard },
];

const secondaryNavigation: NavItem[] = [
  { name: 'Catálogo', href: '/catalogo', icon: FiList },
  { name: 'Plantillas', href: '/plantillas', icon: FiBookmark },
  { name: 'Ajustes', href: '/ajustes', icon: FiSettings },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, hasHydrated, login, logout } = useAuthStore();

  // ── Session inactivity timeout ─────────────────────────────────────
  useSessionTimeout(() => {
    toast('Su sesión expirará pronto por inactividad', { icon: '⏱️' });
  });

  // ── Force password change redirect ─────────────────────────────────
  useEffect(() => {
    if (user?.mustChangePassword && pathname !== '/cambiar-contrasena') {
      router.replace('/cambiar-contrasena');
    }
  }, [user?.mustChangePassword, pathname, router]);

  const isOperationalAdmin = !!user?.isAdmin;
  const primaryItems = isOperationalAdmin
    ? primaryNavigation.filter((item) => item.href === '/' || item.href === '/pacientes')
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; type: 'patient' | 'encounter'; title: string; subtitle: string; href: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const isEncounterWorkspace = /^\/atenciones\/[^/]+$/.test(pathname);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !hasHydrated || authCheckComplete) {
      return;
    }

    let cancelled = false;

    const bootstrapSession = async () => {
      try {
        const response = await api.get('/auth/me');
        if (cancelled) return;

        login({
          id: response.data.id,
          email: response.data.email,
          nombre: response.data.nombre,
          role: response.data.role as 'MEDICO' | 'ASISTENTE' | 'ADMIN',
          isAdmin: !!response.data.isAdmin,
          medicoId: response.data.medicoId ?? null,
          mustChangePassword: !!response.data.mustChangePassword,
          totpEnabled: !!response.data.totpEnabled,
        });
      } catch {
        if (cancelled) return;
        logout();
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
  }, [authCheckComplete, hasHydrated, login, logout, mounted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close search when clicking outside
  useEffect(() => {
    if (!searchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchOpen]);

  const performSearch = useCallback(async (q: string) => {
    if (isOperationalAdmin) {
      setSearchResults([]);
      return;
    }
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const [patientsRes, encountersRes] = await Promise.allSettled([
        api.get(`/patients?search=${encodeURIComponent(q)}&limit=5`),
        api.get(`/encounters?search=${encodeURIComponent(q)}&limit=5`),
      ]);
      const items: typeof searchResults = [];
      if (patientsRes.status === 'fulfilled' && patientsRes.value.data?.data) {
        for (const p of patientsRes.value.data.data) {
          items.push({ id: p.id, type: 'patient', title: p.nombre, subtitle: p.rut || 'Sin RUT', href: `/pacientes/${p.id}` });
        }
      }
      if (encountersRes.status === 'fulfilled' && encountersRes.value.data?.data) {
        for (const enc of encountersRes.value.data.data) {
          items.push({ id: enc.id, type: 'encounter', title: enc.patient?.nombre || 'Atención', subtitle: `${enc.status === 'EN_PROGRESO' ? 'En progreso' : enc.status === 'COMPLETADO' ? 'Completado' : 'Cancelado'} — ${new Date(enc.createdAt).toLocaleDateString('es-CL')}`, href: `/atenciones/${enc.id}` });
        }
      }
      setSearchResults(items);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [isOperationalAdmin]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSearchActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 300);
  };

  const handleSearchNavigate = (href: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    router.push(href);
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Clear local state even if server call fails
    }
    logout();
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
        <aside className="hidden lg:flex flex-col w-64 bg-frame m-4 rounded-shell shadow-elevated z-10 flex-shrink-0" style={{ overflow: 'clip' }}>
          {/* Logo */}
          <div className="h-24 flex items-center px-8">
            <Link href="/" className="flex items-center gap-2" aria-label="Inicio — Anamneo">
              <AnamneoLogo
                className="gap-2"
                iconClassName="h-8 w-8 brightness-0 invert"
                textClassName="text-2xl font-extrabold text-white tracking-tight"
              />
            </Link>
          </div>

          {/* User card */}
          <div className="px-4 pb-5 mb-4 border-b border-white/20">
            <div className="flex items-center gap-3 bg-frame-dark p-3 rounded-card">
              <div className="h-12 w-12 rounded-full bg-surface-inset flex items-center justify-center font-bold text-frame text-lg flex-shrink-0">
                {getNameInitial(user?.nombre)}
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-sm font-bold text-white truncate" title={user?.nombre}>{user?.nombre}</p>
                <p className="text-xs text-white/50 font-medium capitalize truncate">
                  {user?.isAdmin ? 'Administrador' : user?.role === 'MEDICO' ? 'Médico' : 'Asistente'}
                </p>
              </div>
            </div>
          </div>

          {/* Search (inside sidebar) */}
          {!isOperationalAdmin ? (
            <div className="px-4 mb-3" ref={searchContainerRef}>
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchOpen(false);
                      setSearchQuery('');
                      setSearchResults([]);
                      setSearchActiveIndex(-1);
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSearchActiveIndex((prev) =>
                        prev < searchResults.length - 1 ? prev + 1 : 0
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSearchActiveIndex((prev) =>
                        prev > 0 ? prev - 1 : searchResults.length - 1
                      );
                    } else if (e.key === 'Enter' && searchActiveIndex >= 0 && searchResults[searchActiveIndex]) {
                      e.preventDefault();
                      handleSearchNavigate(searchResults[searchActiveIndex].href);
                    }
                  }}
                  placeholder="Buscar… ⌘K"
                  role="combobox"
                  aria-expanded={searchOpen && !!searchQuery.trim()}
                  aria-controls="search-results-listbox"
                  aria-autocomplete="list"
                  aria-activedescendant={searchActiveIndex >= 0 && searchResults[searchActiveIndex] ? `search-result-${searchResults[searchActiveIndex].id}` : undefined}
                  aria-label="Buscar pacientes y atenciones"
                  className="w-full bg-white/[0.08] text-white placeholder:text-white/30 text-sm rounded-pill pl-10 pr-4 py-2.5 outline-none border border-white/[0.1] focus:border-accent/50 focus:bg-white/[0.12] transition-colors"
                />

                {/* Search results dropdown */}
                {searchOpen && searchQuery.trim() && (
                  <div id="search-results-listbox" role="listbox" aria-label="Resultados de búsqueda" className="absolute left-0 top-full mt-2 w-full bg-surface-elevated rounded-card shadow-dropdown border border-surface-muted/30 overflow-hidden z-50 animate-fade-in">
                    {searchLoading && (
                      <div className="flex items-center justify-center py-6">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent" />
                      </div>
                    )}
                    {!searchLoading && searchResults.length === 0 && (
                      <div className="text-center py-6 text-ink-muted text-sm">
                        Sin resultados para &ldquo;{searchQuery}&rdquo;
                      </div>
                    )}
                    {!searchLoading && searchResults.length > 0 && (
                      <div className="py-1.5 max-h-72 overflow-y-auto">
                        {searchResults.filter(r => r.type === 'patient').length > 0 && (
                          <div>
                            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Pacientes</div>
                            {searchResults.filter(r => r.type === 'patient').map((r) => {
                              const flatIndex = searchResults.indexOf(r);
                              return (
                              <button key={r.id} id={`search-result-${r.id}`} role="option" aria-selected={flatIndex === searchActiveIndex} onClick={() => handleSearchNavigate(r.href)} onMouseEnter={() => setSearchActiveIndex(flatIndex)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${flatIndex === searchActiveIndex ? 'bg-surface-inset/70' : 'hover:bg-surface-inset/50'}`}>
                                <FiUser className="w-4 h-4 text-ink-muted shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-ink truncate">{r.title}</p>
                                  <p className="text-micro text-ink-muted truncate">{r.subtitle}</p>
                                </div>
                                <FiArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                              </button>
                              );
                            })}
                          </div>
                        )}
                        {searchResults.filter(r => r.type === 'encounter').length > 0 && (
                          <div>
                            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Atenciones</div>
                            {searchResults.filter(r => r.type === 'encounter').map((r) => {
                              const flatIndex = searchResults.indexOf(r);
                              return (
                              <button key={r.id} id={`search-result-${r.id}`} role="option" aria-selected={flatIndex === searchActiveIndex} onClick={() => handleSearchNavigate(r.href)} onMouseEnter={() => setSearchActiveIndex(flatIndex)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${flatIndex === searchActiveIndex ? 'bg-surface-inset/70' : 'hover:bg-surface-inset/50'}`}>
                                <FiFileText className="w-4 h-4 text-ink-muted shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-ink truncate">{r.title}</p>
                                  <p className="text-micro text-ink-muted truncate">{r.subtitle}</p>
                                </div>
                                <FiArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                              </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Navigation */}
          <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto sidebar-scroll" aria-label="Navegación principal">
            {primaryItems.map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    'w-full flex items-center px-4 py-3.5 text-sm font-bold rounded-pill transition-all',
                    isActive
                      ? 'bg-accent text-accent-text'
                      : 'text-white/50 hover:bg-frame-dark hover:text-white'
                  )}
                >
                  <item.icon className={clsx('mr-4 h-5 w-5', isActive ? 'text-accent-text' : 'text-white/40')} />
                  {item.name}
                </Link>
              );
            })}

            {/* Divider */}
            <div className="my-3 mx-2 border-t border-white/[0.12]" />

            {secondaryItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    'w-full flex items-center px-4 py-3.5 text-sm font-bold rounded-pill transition-all',
                    isActive
                      ? 'bg-accent text-accent-text'
                      : 'text-white/50 hover:bg-frame-dark hover:text-white'
                  )}
                >
                  <item.icon className={clsx('mr-4 h-5 w-5', isActive ? 'text-accent-text' : 'text-white/40')} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-6">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-full px-4 py-3 text-sm font-bold text-white/50 bg-frame-dark hover:text-white hover:bg-status-red rounded-pill transition-colors"
            >
              <FiLogOut className="mr-3 h-5 w-5" />
              Salir
            </button>
          </div>
        </aside>

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
          <div className={clsx('flex-shrink-0', isEncounterWorkspace && 'hidden')}>
            <SmartHeaderBar onSearchOpen={() => setSearchOpen(true)} />
          </div>

          {/* ── Page Content ───────────────────────────────────── */}
          <main            id="main-content"            className={clsx(
              'flex-1 overflow-auto',
              isEncounterWorkspace ? 'px-0 py-0' : 'px-3 py-6 lg:px-8 lg:py-8',
            )}
          >
            <div className={clsx(!isEncounterWorkspace && 'max-w-7xl mx-auto')}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
