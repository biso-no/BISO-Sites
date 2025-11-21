"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { FilterState } from "@/lib/hooks/use-departments-filter";
import { DepartmentFilters } from "./department-filters";

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
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = (key: keyof FilterState, value: any) => {
    const params = new URLSearchParams(searchParams.toString());

    // Map filter keys to URL param names
    const paramName = key === "searchTerm" ? "search" : key;

    // Remove param if value is undefined/null, otherwise set it
    if (value === undefined || value === null || value === "") {
      params.delete(paramName);
    } else {
      params.set(paramName, String(value));
    }

    // Only update if URL actually changed
    const newQueryString = params.toString();
    const currentQueryString = searchParams.toString();

    if (newQueryString !== currentQueryString) {
      startTransition(() => {
        const newUrl = newQueryString
          ? `${pathname}?${newQueryString}`
          : pathname;
        router.replace(newUrl, { scroll: false });
      });
    }
  };

  const resetFilters = () => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  const setSearchTerm = (term: string) => {
    updateFilter("searchTerm", term);
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
