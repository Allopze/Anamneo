'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { FiSearch, FiUser, FiFileText, FiArrowRight } from 'react-icons/fi';

interface SearchResult {
  id: string;
  type: 'patient' | 'encounter';
  title: string;
  subtitle: string;
  href: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const patientResults = results.filter((result) => result.type === 'patient');
  const encounterResults = results.filter((result) => result.type === 'encounter');

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const navigateTo = useCallback(
    (result: SearchResult) => {
      onClose();
      router.push(result.href);
    },
    [onClose, router],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (results.length === 0) {
        return;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        navigateTo(results[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose, navigateTo]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const [patientsRes, encountersRes] = await Promise.allSettled([
        api.get(`/patients?search=${encodeURIComponent(q)}&limit=5`),
        api.get(`/encounters?search=${encodeURIComponent(q)}&limit=5`),
      ]);

      const items: SearchResult[] = [];

      if (patientsRes.status === 'fulfilled' && patientsRes.value.data?.data) {
        for (const p of patientsRes.value.data.data) {
          items.push({
            id: p.id,
            type: 'patient',
            title: p.nombre,
            subtitle: p.rut || 'Sin RUT',
            href: `/pacientes/${p.id}`,
          });
        }
      }

      if (encountersRes.status === 'fulfilled' && encountersRes.value.data?.data) {
        for (const e of encountersRes.value.data.data) {
          items.push({
            id: e.id,
            type: 'encounter',
            title: e.patient?.nombre || 'Atención',
            subtitle: `${e.status === 'EN_PROGRESO' ? 'En progreso' : e.status === 'COMPLETADO' ? 'Completado' : 'Cancelado'} — ${new Date(e.createdAt).toLocaleDateString('es-CL')}`,
            href: `/atenciones/${e.id}`,
          });
        }
      }

      setResults(items);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  if (!isOpen) return null;

  let flatIndex = -1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-ink-primary/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
        <div className="w-full max-w-lg bg-surface-elevated rounded-xl shadow-2xl border border-surface-muted/30 overflow-hidden" role="dialog" aria-modal="true" aria-label="Búsqueda rápida">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-surface-muted/30">
            <FiSearch className="w-5 h-5 text-ink-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Buscar pacientes, atenciones..."
              className="w-full py-4 text-base outline-none placeholder:text-ink-muted"
              aria-label="Buscar"
              aria-autocomplete="list"
              role="combobox"
              aria-expanded={results.length > 0}
            />
            <kbd className="hidden sm:inline-flex px-2 py-0.5 text-xs font-medium text-ink-muted bg-surface-muted border border-surface-muted/30 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent" />
              </div>
            )}

            {!loading && query.trim() && results.length === 0 && (
              <div className="text-center py-8 text-ink-muted">
                <p className="text-sm">No se encontraron resultados para &ldquo;{query}&rdquo;</p>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="py-2">
                {[
                  { label: 'Pacientes', items: patientResults },
                  { label: 'Atenciones', items: encounterResults },
                ]
                  .filter((group) => group.items.length > 0)
                  .map((group) => (
                    <div key={group.label}>
                      <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        {group.label}
                      </div>
                      <ul role="listbox">
                        {group.items.map((result) => {
                          const currentIndex = flatIndex + 1;
                          flatIndex = currentIndex;
                          const isSelected = currentIndex === selectedIndex;

                          return (
                            <li key={`${result.type}-${result.id}`}>
                              <button
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                  isSelected
                                    ? 'border border-status-yellow/60 bg-status-yellow/30 text-accent-text'
                                    : 'hover:bg-surface-base/40'
                                }`}
                                onClick={() => navigateTo(result)}
                                onMouseEnter={() => setSelectedIndex(currentIndex)}
                              >
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    result.type === 'patient'
                                      ? 'border border-status-yellow/65 bg-status-yellow/35 text-accent-text'
                                      : 'bg-emerald-100 text-emerald-600'
                                  }`}
                                >
                                  {result.type === 'patient' ? (
                                    <FiUser className="w-4 h-4" />
                                  ) : (
                                    <FiFileText className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{result.title}</p>
                                  <p className="text-xs text-ink-muted truncate">{result.subtitle}</p>
                                </div>
                                <FiArrowRight className="w-4 h-4 text-ink-muted shrink-0" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
              </div>
            )}

            {!loading && !query.trim() && (
              <div className="px-4 py-6 text-center text-ink-muted">
                <p className="text-sm">Escribe para buscar pacientes y atenciones</p>
                <p className="text-xs mt-1">Usa ↑↓ para navegar, Enter para seleccionar, Ctrl+K o ⌘K para abrir</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
