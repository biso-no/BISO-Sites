"use client";

import { useState, useCallback, useTransition } from 'react';
import { Department } from '../admin/departments';

export type FilterState = {
  active: boolean | undefined;
  campus_id: string | undefined;
  type: string | undefined;
  searchTerm: string | undefined;
};

export default function useDepartmentsFilter() {
  const [filters, setFilters] = useState<FilterState>({
    active: true, // Default to showing active departments
    campus_id: undefined,
    type: undefined,
    searchTerm: undefined,
  });
  
  const [isPending, startTransition] = useTransition();
  
  const updateFilter = useCallback((key: keyof FilterState, value: any) => {
    startTransition(() => {
      setFilters(prev => ({
        ...prev,
        [key]: value
      }));
    });
  }, []);
  
  const resetFilters = useCallback(() => {
    startTransition(() => {
      setFilters({
        active: true,
        campus_id: undefined,
        type: undefined,
        searchTerm: undefined,
      });
    });
  }, []);
  
  const setSearchTerm = useCallback((term: string) => {
    // Debounced search term update
    const timeoutId = setTimeout(() => {
      updateFilter('searchTerm', term.trim() || undefined);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [updateFilter]);
  
  return {
    filters,
    isPending,
    updateFilter,
    resetFilters,
    setSearchTerm,
  };
} 