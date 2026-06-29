'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchClinicalSearchResults, type SearchResult } from '@/lib/clinical-search';

export type { SearchResult } from '@/lib/clinical-search';

export function useDashboardSearch(isOperationalAdmin: boolean) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const performSearch = useCallback(async (q: string) => {
    const trimmedQuery = q.trim();

    abortRef.current?.abort();
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;

    if (isOperationalAdmin) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setSearchLoading(true);
    try {
      const items = await fetchClinicalSearchResults(trimmedQuery, { signal: controller.signal });
      if (controller.signal.aborted || requestSeq !== requestSeqRef.current) return;
      setSearchResults(items);
    } catch {
      if (controller.signal.aborted || requestSeq !== requestSeqRef.current) return;
      setSearchResults([]);
    } finally {
      if (!controller.signal.aborted && requestSeq === requestSeqRef.current) {
        setSearchLoading(false);
      }
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
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchLoading(false);
    setSearchActiveIndex(-1);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
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
