import { Suspense } from "react";
import { getCampuses } from "@/app/actions/campus";
import { DepartmentActionsHeader } from "@/components/units/department-actions-header";
import { DepartmentFiltersWrapper } from "@/components/units/department-filters-wrapper";
import { DepartmentSkeleton } from "@/components/units/department-skeleton";
import { DepartmentStats } from "@/components/units/department-stats";
import { DepartmentsInfiniteList } from "@/components/units/departments-infinite-list";
import { UnitsHeroSection } from "@/components/units/units-hero-section";
import {
  getDepartmentsClient,
  getDepartmentTypes,
} from "@/lib/actions/departments";
import type { FilterState } from "@/lib/hooks/use-departments-filter";

export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{
    active?: string;
    campus_id?: string;
    type?: string;
    search?: string;
  }>;
};

const PAGE_SIZE = 20;

function parseActiveParam(active?: string): boolean | undefined {
  if (active === "true") {
    return true;
  }
  if (active === "false") {
    return false;
  }
  return;
}

export default async function UnitsPage({ searchParams }: PageProps) {
  // Await searchParams before using its properties
  const params = await searchParams;

  // Prepare filter values from search params
  const filters: FilterState = {
    active: parseActiveParam(params.active),
    campus_id: params.campus_id,
    type: params.type,
    searchTerm: params.search,
  };

  // Fetch initial departments with pagination
  const { departments, hasMore } = await getDepartmentsClient({
    active: filters.active,
    campusId: filters.campus_id,
    type: filters.type,
    search: filters.searchTerm,
    limit: PAGE_SIZE,
    offset: 0,
  });

  // Fetch campuses for filter dropdown (separate query)
  const campusesData = await getCampuses();
  const campusOptions = campusesData.map((c) => ({ id: c.$id, name: c.name }));

  // Get all department types for filter dropdown
  const types = await getDepartmentTypes();

  return (
    <div className="space-y-8">
      {/* Premium Hero Section */}
      <UnitsHeroSection
        campusOptions={campusOptions}
        totalDepartments={departments.length}
      />

      {/* Stats cards */}
      <Suspense fallback={<div>Loading stats...</div>}>
        <DepartmentStats departments={departments} />
      </Suspense>

      <div className="space-y-6">
        {/* Actions and Filters Row */}
        <div className="flex flex-col justify-between gap-4 md:flex-row">
          <DepartmentFiltersWrapper
            campuses={campusOptions}
            filters={filters}
            types={types}
          />
          <DepartmentActionsHeader campuses={campusOptions} types={types} />
        </div>

        {/* Results count */}
        <div className="text-muted-foreground text-sm">
          Showing {departments.length} department
          {departments.length !== 1 ? "s" : ""}
          {hasMore && " (scroll for more)"}
        </div>

        {/* Department List with Infinite Scroll */}
        <Suspense fallback={<DepartmentSkeleton />}>
          <DepartmentsInfiniteList
            filters={{
              active: filters.active,
              campus_id: filters.campus_id,
              type: filters.type,
              search: filters.searchTerm,
            }}
            hasMore={hasMore}
            initialDepartments={departments}
            pageSize={PAGE_SIZE}
          />
        </Suspense>
      </div>
    </div>
  );
}
