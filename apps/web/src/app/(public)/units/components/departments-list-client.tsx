"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import {
  parseUnitCategory,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import {
  DepartmentsFiltersClient,
  type FilterState,
} from "./departments-filters-client";
import { DepartmentsGrid } from "./departments-grid";

interface DepartmentsListClientProps {
  availableCategories: UnitCategory[];
  departments: ContentTranslations[];
}

const stripHtml = (html?: string | null) => {
  if (!html) {
    return "";
  }
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const matchesCampus = (
  deptRef: ContentTranslations["department_ref"] | undefined,
  campusId: FilterState["campusId"]
) => !campusId || deptRef?.campus_id === campusId;

// Uncategorised units only drop out when a category is actively picked.
const matchesCategory = (
  deptRef: ContentTranslations["department_ref"] | undefined,
  category: FilterState["category"]
) => !category || parseUnitCategory(deptRef?.type) === category;

const matchesSearch = (dept: ContentTranslations, search: string) => {
  if (!search) {
    return true;
  }
  const searchLower = search.toLowerCase();
  const searchableText = [
    dept.title,
    dept.department_ref?.type,
    dept.department_ref?.campus?.name,
    stripHtml(dept.short_description || dept.description),
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(searchLower);
};

const departmentMatchesFilters = (
  dept: ContentTranslations,
  filters: FilterState
) => {
  const deptRef = dept.department_ref;
  if (!deptRef) {
    return false;
  }

  return (
    matchesCampus(deptRef, filters.campusId) &&
    matchesCategory(deptRef, filters.category) &&
    matchesSearch(dept, filters.search)
  );
};

export function DepartmentsListClient({
  departments,
  availableCategories,
}: DepartmentsListClientProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    campusId: null,
    category: null,
  });

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  // Filter departments based on current filters
  const filteredDepartments = useMemo(
    () => departments.filter((dept) => departmentMatchesFilters(dept, filters)),
    [departments, filters]
  );

  // Sort departments by campus name, then by department name
  const sortedDepartments = useMemo(
    () =>
      [...filteredDepartments].sort((a, b) => {
        const campusCompare = (
          a.department_ref?.campus?.name || ""
        ).localeCompare(b.department_ref?.campus?.name || "");
        if (campusCompare !== 0) {
          return campusCompare;
        }
        return a.title.localeCompare(b.title);
      }),
    [filteredDepartments]
  );

  return (
    <>
      {/* Filters */}
      <DepartmentsFiltersClient
        availableCategories={availableCategories}
        onFilterChange={handleFilterChange}
      />

      {/* Results Count */}
      <div className="mt-8 mb-8 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-2xl text-foreground">
            {sortedDepartments.length}{" "}
            {sortedDepartments.length === 1 ? "Enhet" : "Enheter"}
          </h2>
          <p className="text-muted-foreground">
            Klikk på en enhet for å lære mer om deres arbeid og team
          </p>
        </div>
      </div>

      {/* Departments Grid with Animation */}
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={`${filters.search}-${filters.campusId}-${filters.category}`}
          transition={{ duration: 0.3 }}
        >
          <DepartmentsGrid departments={sortedDepartments} />
        </motion.div>
      </AnimatePresence>
    </>
  );
}
