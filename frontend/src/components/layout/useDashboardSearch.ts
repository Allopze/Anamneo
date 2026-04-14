'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { STATUS_LABELS } from '@/types';

export type SearchResult = {
  id: string;
  type: 'patient' | 'encounter';
  title: string;
  subtitle: string;
  href: string;
};

export function useDashboardSearch(isOperationalAdmin: boolean) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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
      const items: SearchResult[] = [];
      if (patientsRes.status === 'fulfilled' && patientsRes.value.data?.data) {
        for (const p of patientsRes.value.data.data) {
          items.push({ id: p.id, type: 'patient', title: p.nombre, subtitle: p.rut || 'Sin RUT', href: `/pacientes/${p.id}` });
        }
      }
      if (encountersRes.status === 'fulfilled' && encountersRes.value.data?.data) {
        for (const enc of encountersRes.value.data.data) {
          items.push({ id: enc.id, type: 'encounter', title: enc.patient?.nombre || 'Atención', subtitle: `${STATUS_LABELS[enc.status] || enc.status} — ${new Date(enc.createdAt).toLocaleDateString('es-CL')}`, href: `/atenciones/${enc.id}` });
        }
      }
      setSearchResults(items);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [isOperationalAdmin]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setSearchActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 300);
  }, [performSearch]);

  const handleSearchNavigate = useCallback((href: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    router.push(href);
  }, [router]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchActiveIndex(-1);
  }, []);

  return {
    searchOpen,
    setSearchOpen,
    searchQuery,
    searchResults,
    searchLoading,
    searchActiveIndex,
    setSearchActiveIndex,
    handleSearchChange,
    handleSearchNavigate,
    closeSearch,
  };
}
