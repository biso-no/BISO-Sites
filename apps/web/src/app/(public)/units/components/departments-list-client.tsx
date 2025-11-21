"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import {
  DepartmentsFiltersClient,
  type FilterState,
} from "./departments-filters-client";
import { DepartmentsGrid } from "./departments-grid";

interface DepartmentsListClientProps {
  departments: ContentTranslations[];
  availableTypes: string[];
}

const stripHtml = (html?: string | null) => {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export function DepartmentsListClient({
  departments,
  availableTypes,
}: DepartmentsListClientProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    campusId: null,
    type: null,
  });

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  // Filter departments based on current filters
  const filteredDepartments = useMemo(() => {
    return departments.filter((dept) => {
      const deptRef = dept.department_ref;
      if (!deptRef) return false;

      // Campus filter
      if (filters.campusId && deptRef.campus_id !== filters.campusId) {
        return false;
      }

      // Type filter
      if (filters.type && deptRef.type !== filters.type) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableText = [
          dept.title,
          deptRef.type,
          deptRef.campus?.name,
          stripHtml(dept.short_description || dept.description),
        ]
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }, [departments, filters]);

  // Sort departments by campus name, then by department name
  const sortedDepartments = useMemo(() => {
    return [...filteredDepartments].sort((a, b) => {
      const campusCompare = (
        a.department_ref?.campus?.name || ""
      ).localeCompare(b.department_ref?.campus?.name || "");
      if (campusCompare !== 0) return campusCompare;
      return a.title.localeCompare(b.title);
    });
  }, [filteredDepartments]);

  return (
    <>
      {/* Filters */}
      <DepartmentsFiltersClient
        availableTypes={availableTypes}
        onFilterChange={handleFilterChange}
      />

      {/* Results Count */}
      <div className="flex items-center justify-between mt-8 mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
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
          key={`${filters.search}-${filters.campusId}-${filters.type}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DepartmentsGrid departments={sortedDepartments} />
        </motion.div>
      </AnimatePresence>
    </>
  );
}
