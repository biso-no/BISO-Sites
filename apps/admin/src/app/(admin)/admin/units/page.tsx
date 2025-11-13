import { Suspense } from 'react';
import { getDepartments, getDepartmentTypes } from '@/lib/actions/departments';
import { getCampuses } from '@/app/actions/campus';
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

  // Fetch departments directly with filters applied server-side
  const departmentsData = await getDepartments({
    active: filters.active,
    campusId: filters.campus_id,
    type: filters.type,
    search: filters.searchTerm,
  });
  
  // Transform departments to include computed fields
  let departments = departmentsData.map(dept => ({
    ...dept,
    name: dept.Name,
    campusName: dept.campus?.name || 'Unknown',
    userCount: 0 // TODO: Add user count when needed
  }));

  // Client-side sorting (done after filtering from server)
  const sortOrder = params.sort || 'name-asc';
  const [sortField, sortDirection] = sortOrder.split('-');
  
  departments.sort((a, b) => {
    let compareA: any;
    let compareB: any;
    
    switch (sortField) {
      case 'name':
        compareA = a.name?.toLowerCase() || '';
        compareB = b.name?.toLowerCase() || '';
        break;
      case 'campus':
        compareA = a.campusName?.toLowerCase() || '';
        compareB = b.campusName?.toLowerCase() || '';
        break;
      case 'users':
        compareA = a.userCount || 0;
        compareB = b.userCount || 0;
        break;
      default:
        compareA = a.name?.toLowerCase() || '';
        compareB = b.name?.toLowerCase() || '';
    }
    
    if (compareA < compareB) return sortDirection === 'asc' ? -1 : 1;
    if (compareA > compareB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  
  // Fetch campuses for filter dropdown (separate query)
  const campusesData = await getCampuses();
  const campusOptions = campusesData.map(c => ({ id: c.$id, name: c.name }));
  
  // Get all department types for filter dropdown
  const types = await getDepartmentTypes();
  
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
            campuses={campusOptions}
            types={types}
          />
          <DepartmentActionsHeader 
            sortOrder={sortOrder}
            campuses={campusOptions}
            types={types}
          />
        </div>

        {/* Department List */}
        <Suspense fallback={<DepartmentSkeleton />}>
          <DepartmentList
            departments={departments}
            campuses={campusOptions}
            types={types}
          />
        </Suspense>
      </div>
    </div>
  );
}