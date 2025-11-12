import { Suspense } from 'react';
import { getDepartments, getDepartmentTypes } from '@/lib/admin/departments';
import { getCampuses } from '@/lib/admin/db';
import { DepartmentStats } from '@/components/units/department-stats';
import { DepartmentFiltersWrapper } from '@/components/units/department-filters-wrapper';
import { DepartmentList } from '@/components/units/department-list';
import { DepartmentActionsHeader } from '@/components/units/department-actions-header';
import { DepartmentSkeleton } from '@/components/units/department-skeleton';
import { FilterState } from '@/lib/hooks/use-departments-filter';

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{
    active?: string;
    campus_id?: string;
    type?: string;
    search?: string;
    sort?: string;
  }>;
}

export default async function UnitsPage({ searchParams }: PageProps) {
  // Await searchParams before using its properties
  const params = await searchParams;
  
  // Prepare filter values from search params
  const filters: FilterState = {
    active: params.active === 'false' 
      ? false
      : params.active === 'true'
        ? true
        : undefined,
    campus_id: params.campus_id,
    type: params.type,
    searchTerm: params.search
  };

  // Fetch data concurrently
  const [departments, campuses, types] = await Promise.all([
    getDepartments(filters),
    getCampuses(),
    getDepartmentTypes()
  ]);
  
  // Sort departments if needed
  let sortedDepartments = [...departments];
  const sortOrder = params.sort || 'name-asc';
  const [sortField, sortDirection] = sortOrder.split('-');
  
  if (sortField && sortDirection) {
    sortedDepartments.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'campus':
          comparison = (a.campusName || '').localeCompare(b.campusName || '');
          break;
        case 'users':
          comparison = (a.userCount || 0) - (b.userCount || 0);
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }
  
  return (
    <div className="space-y-8">
      {/* Header section with title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Units Overview</h1>
        <p className="text-muted-foreground mt-1">
          Manage all departments across all campuses
        </p>
      </div>
      
      {/* Stats cards */}
      <Suspense fallback={<div>Loading stats...</div>}>
        <DepartmentStats departments={departments} />
      </Suspense>
      
      <div className="space-y-6">
        {/* Actions and Filters Row */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <DepartmentFiltersWrapper
            filters={filters}
            campuses={campuses}
            types={types}
          />
          <DepartmentActionsHeader 
            sortOrder={sortOrder}
            campuses={campuses}
            types={types}
          />
        </div>

        {/* Department List */}
        <Suspense fallback={<DepartmentSkeleton />}>
          <DepartmentList
            departments={sortedDepartments}
            campuses={campuses}
            types={types}
          />
        </Suspense>
      </div>
    </div>
  );
}