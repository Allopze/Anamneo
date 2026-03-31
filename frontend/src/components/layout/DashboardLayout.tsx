'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';
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
import clsx from 'clsx';
import { getNameInitial } from '@/lib/utils';
import OfflineBanner from '@/components/common/OfflineBanner';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const primaryNavigation = [
  { name: 'Inicio', href: '/', icon: FiHome, exact: true },
  { name: 'Pacientes', href: '/pacientes', icon: FiUsers },
  { name: 'Atenciones', href: '/atenciones', icon: FiFileText },
  { name: 'Seguimientos', href: '/seguimientos', icon: FiClipboard },
];

const secondaryNavigation = [
  { name: 'Catálogo', href: '/catalogo', icon: FiList },
  { name: 'Plantillas', href: '/plantillas', icon: FiBookmark },
  { name: 'Ajustes', href: '/ajustes', icon: FiSettings },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, hasHydrated, login, logout } = useAuthStore();
  const primaryItems = primaryNavigation;
  const secondaryItems = [
    ...secondaryNavigation,
    ...(user?.isAdmin
      ? [
          { name: 'Admin', href: '/admin/usuarios', icon: FiShield },
          { name: 'Auditoría', href: '/admin/auditoria', icon: FiList },
        ]
      : []),
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; type: 'patient' | 'encounter'; title: string; subtitle: string; href: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !hasHydrated || authCheckComplete) {
      return;
    }

    if (isAuthenticated) {
      setAuthCheckComplete(true);
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
  }, [authCheckComplete, hasHydrated, isAuthenticated, login, logout, mounted, router]);

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
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
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
      <OfflineBanner />

      {/* ── App Shell ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1440px] min-h-screen flex flex-col">

        {/* ── Top Header Bar (dark frame) ──────────────────────────── */}
        <header className="sticky top-0 z-40 bg-frame rounded-b-shell">
          <div className="flex items-center justify-between h-14 px-4 lg:px-6">
            {/* Left: Logo + Primary Nav */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 flex-shrink-0">
                <AnamneoLogo
                  className="gap-2"
                  iconClassName="h-7 w-7"
                  textClassName="text-base font-semibold text-ink-onDark"
                />
              </Link>

              {/* Desktop primary nav — text-only pills */}
              <nav className="hidden lg:flex items-center gap-1" aria-label="Navegación principal">
                {primaryItems.map((item) => {
                  const isActive = (item as any).exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={clsx(
                        'px-3.5 py-1.5 rounded-pill text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-accent text-accent-text'
                          : 'text-ink-onDark/60 hover:text-ink-onDark hover:bg-surface-elevated/10'
                      )}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: Search + User */}
            <div className="flex items-center gap-1.5">
              {/* Inline expanding search */}
              <div ref={searchContainerRef} className="relative flex items-center">
                <button
                  onClick={() => {
                    setSearchOpen(!searchOpen);
                    if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
                    else { setSearchQuery(''); setSearchResults([]); }
                  }}
                  className={clsx(
                    'p-2 rounded-full transition-all duration-200',
                    searchOpen
                      ? 'text-ink-onDark bg-surface-elevated/15'
                      : 'text-ink-onDark/50 hover:text-ink-onDark hover:bg-surface-elevated/10'
                  )}
                  aria-label="Buscar (⌘K)"
                >
                  <FiSearch className="w-4 h-4" />
                </button>

                <div
                  className={clsx(
                    'absolute right-10 top-1/2 -translate-y-1/2 overflow-hidden transition-all duration-300 ease-out',
                    searchOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'
                  )}
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearchOpen(false);
                        setSearchQuery('');
                        setSearchResults([]);
                      }
                    }}
                    placeholder="Buscar..."
                    className="w-full bg-surface-elevated/15 text-ink-onDark placeholder:text-ink-onDark/40 text-sm rounded-pill px-4 py-1.5 outline-none border border-surface-elevated/20 focus:border-accent/50 transition-colors"
                  />
                </div>

                {/* Search results dropdown */}
                {searchOpen && searchQuery.trim() && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-surface-elevated rounded-card shadow-dropdown border border-surface-muted/30 overflow-hidden z-50 animate-fade-in">
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
                            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Pacientes</div>
                            {searchResults.filter(r => r.type === 'patient').map((r) => (
                              <button key={r.id} onClick={() => handleSearchNavigate(r.href)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-base/50 transition-colors">
                                <FiUser className="w-4 h-4 text-ink-muted shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-ink truncate">{r.title}</p>
                                  <p className="text-micro text-ink-muted truncate">{r.subtitle}</p>
                                </div>
                                <FiArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.filter(r => r.type === 'encounter').length > 0 && (
                          <div>
                            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Atenciones</div>
                            {searchResults.filter(r => r.type === 'encounter').map((r) => (
                              <button key={r.id} onClick={() => handleSearchNavigate(r.href)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-base/50 transition-colors">
                                <FiFileText className="w-4 h-4 text-ink-muted shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-ink truncate">{r.title}</p>
                                  <p className="text-micro text-ink-muted truncate">{r.subtitle}</p>
                                </div>
                                <FiArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User avatar + dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={clsx(
                    'p-1 rounded-full transition-all',
                    userMenuOpen
                      ? 'ring-2 ring-accent/50'
                      : 'hover:ring-2 hover:ring-surface-elevated/20'
                  )}
                  aria-label="Menú de usuario"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                    <span className="text-accent-text font-semibold text-xs">
                      {getNameInitial(user?.nombre)}
                    </span>
                  </div>
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 dropdown-surface py-1.5 z-20" role="menu">
                      <div className="dropdown-header">
                        <p className="text-sm font-medium text-ink">{user?.nombre}</p>
                        <p className="text-micro text-ink-muted">{user?.email}</p>
                        <p className="text-micro text-ink-muted mt-0.5">
                          {user?.isAdmin ? 'Administrador' : user?.role === 'MEDICO' ? 'Médico' : 'Asistente'}
                        </p>
                      </div>
                      {/* Secondary nav links */}
                      <div className="border-t border-surface-muted/30 mt-1 pt-1">
                        {secondaryItems.map((item) => (
                          <Link
                            key={item.name}
                            href={item.href}
                            className="dropdown-item"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <item.icon className="w-4 h-4" />
                            {item.name}
                          </Link>
                        ))}
                      </div>
                      <div className="border-t border-surface-muted/30 mt-1 pt-1">
                        <button onClick={handleLogout} className="dropdown-item dropdown-item-danger">
                          <FiLogOut className="w-4 h-4" />
                          Cerrar sesión
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                className="lg:hidden p-2 text-ink-onDark/70 hover:text-ink-onDark"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
              >
                {mobileMenuOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* ── Mobile nav accordion ───────────────────────────────── */}
          {mobileMenuOpen && (
            <nav className="lg:hidden px-4 pb-3 pt-1 border-t border-white/10 animate-fade-in">
              <div className="flex flex-wrap gap-1.5">
                {[...primaryItems, ...secondaryItems].map((item) => {
                  const isActive = (item as any).exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={clsx(
                        'px-3.5 py-2 rounded-pill text-sm font-medium transition-all',
                        isActive
                          ? 'bg-accent text-accent-text'
                          : 'text-ink-onDark/60 hover:bg-surface-elevated/10'
                      )}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </nav>
          )}
        </header>

        {/* ── Page Content ─────────────────────────────────────────── */}
        <main className="flex-1 px-3 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
