"use client";

import { useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { DepartmentFilters } from './department-filters';
import { FilterState } from '@/lib/hooks/use-departments-filter';
import { useUrlUpdate } from '@/lib/hooks/use-url-update';

interface DepartmentFiltersWrapperProps {
  filters: FilterState;
  campuses: Array<{ id: string; name: string }>;
  types: string[];
}

export function DepartmentFiltersWrapper({
  filters,
  campuses,
  types,
}: DepartmentFiltersWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const updateUrl = useUrlUpdate();

  const updateFilter = (key: keyof FilterState, value: any) => {
    startTransition(() => {
      const updates: Record<string, string> = {};
      
      if (key === 'searchTerm') {
        updates.search = value;
      } else {
        updates[key] = String(value);
      }
      
      updateUrl(updates);
    });
  };

  const resetFilters = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  const setSearchTerm = (term: string) => {
    updateFilter('searchTerm', term);
  };

  return (
    <DepartmentFilters
      filters={filters}
      isPending={isPending}
      updateFilter={updateFilter}
      resetFilters={resetFilters}
      setSearchTerm={setSearchTerm}
      campuses={campuses}
      types={types}
    />
  );
} 