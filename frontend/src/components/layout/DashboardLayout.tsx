'use client';

import { useEffect, useState } from 'react';
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
  FiChevronDown,
  FiBookmark,
} from 'react-icons/fi';
import clsx from 'clsx';
import { getNameInitial } from '@/lib/utils';
import OfflineBanner from '@/components/common/OfflineBanner';
import CommandPalette from '@/components/common/CommandPalette';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const baseNavigation = [
  { name: 'Inicio', href: '/', icon: FiHome, exact: true },
  { name: 'Pacientes', href: '/pacientes', icon: FiUsers },
  { name: 'Atenciones', href: '/atenciones', icon: FiFileText },
  { name: 'Catálogo de afecciones', href: '/catalogo', icon: FiList },
  { name: 'Plantillas', href: '/plantillas', icon: FiBookmark },
  { name: 'Ajustes', href: '/ajustes', icon: FiSettings },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, hasHydrated, login, logout } = useAuthStore();
  const navigation = [
    ...baseNavigation,
    ...(user?.isAdmin
      ? [
          { name: 'Administración', href: '/admin/usuarios', icon: FiShield },
          { name: 'Auditoría', href: '/admin/auditoria', icon: FiList },
        ]
      : []),
  ];

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
        router.replace('/login');
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

  // F9: ⌘K / Ctrl+K keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <OfflineBanner />
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 lg:translate-x-0 flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
          <Link href="/" className="flex items-center gap-2">
            <AnamneoLogo
              className="gap-2.5"
              iconClassName="h-8 w-8"
              textClassName="text-lg font-semibold text-slate-900"
            />
          </Link>
          <button
            className="lg:hidden p-2 text-slate-500 hover:text-slate-700"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1" aria-label="Navegación principal">
          {navigation.map((item) => {
            const isActive = (item as any).exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50/80 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <item.icon className="w-5 h-5" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User info at bottom */}
        <div className="mt-auto p-4 border-t border-slate-200 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 font-semibold">
                {getNameInitial(user?.nombre)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.nombre}</p>
              <p className="text-xs text-slate-500">
                {user?.isAdmin
                  ? 'Administrador'
                  : user?.role === 'MEDICO'
                  ? 'Médico'
                  : 'Asistente'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200">
          <div className="h-full px-4 flex items-center justify-between gap-4">
            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 text-slate-500 hover:text-slate-700"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú de navegación"
            >
              <FiMenu className="w-6 h-6" />
            </button>

            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex-1 max-w-md flex items-center gap-3 px-3 py-2 border border-slate-300 rounded-lg text-slate-400 hover:border-primary-400 hover:text-slate-500 transition-all cursor-pointer"
            >
              <FiSearch className="w-5 h-5" />
              <span className="text-sm">Buscar pacientes, atenciones...</span>
              <div className="ml-auto hidden md:flex items-center gap-1 px-1.5 py-0.5 border border-slate-200 rounded bg-slate-50 text-[10px] font-medium text-slate-400">
                <span className="text-xs">⌘</span>K
              </div>
            </button>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50"
                  aria-label="Menú de usuario"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-semibold text-sm">
                      {getNameInitial(user?.nombre)}
                    </span>
                  </div>
                  <FiChevronDown className="w-4 h-4 text-slate-500" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20" role="menu">
                      <div className="px-4 py-2 border-b border-slate-200">
                        <p className="text-sm font-medium text-slate-900">{user?.nombre}</p>
                        <p className="text-xs text-slate-500">{user?.email}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <FiLogOut className="w-4 h-4" />
                        Cerrar sesión
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
