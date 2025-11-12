"use client";

import { useState, useEffect, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Department } from '@/lib/admin/departments';
import { DepartmentCard } from '@/components/units/department-card';
import { DepartmentFilters } from '@/components/units/department-filters';
import { DepartmentEditDialog } from '@/components/units/department-edit-dialog';
import useDepartmentsFilter, { FilterState } from '@/lib/hooks/use-departments-filter';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowUpDown, Plus, Check } from 'lucide-react';

interface DepartmentClientWrapperProps {
  departments: Department[];
  campuses: Array<{ id: string; name: string }>;
  types: string[];
  initialFilters: FilterState;
  sortOrder: string;
}

type SortOption = {
  label: string;
  value: string;
};

export function DepartmentClientWrapper({
  departments,
  campuses,
  types,
  initialFilters,
  sortOrder,
}: DepartmentClientWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editingDepartment, setEditingDepartment] = useState<Department | undefined>(undefined);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const [isPendingNav, startTransition] = useTransition();
  const { filters, isPending: isFiltersPending, updateFilter, resetFilters, setSearchTerm } = useDepartmentsFilter();
  
  // Combined pending state for both filters and navigation
  const isPending = isPendingNav || isFiltersPending;
  
  // Set initial filters only on component mount in a batch
  useEffect(() => {
    // Create a function to update all filters at once to avoid multiple transitions
    const batchUpdateFilters = () => {
      // Start a single transition for all updates
      startTransition(() => {
        // Only update what's different from the defaults
        if (initialFilters.active !== true) updateFilter('active', initialFilters.active);
        if (initialFilters.campus_id) updateFilter('campus_id', initialFilters.campus_id);
        if (initialFilters.type) updateFilter('type', initialFilters.type);
        if (initialFilters.searchTerm) {
          // Direct update for search term to avoid the debounce
          updateFilter('searchTerm', initialFilters.searchTerm);
        }
      });
    };

    // Apply the batch update
    batchUpdateFilters();
  }, [initialFilters.active, initialFilters.campus_id, initialFilters.searchTerm, initialFilters.type, updateFilter]);  // Empty dependency array to run only once on mount
  
  // Update URL when filters change
  useEffect(() => {
    if (isPending) return; // Don't update URL while filters are being applied
    
    const params = new URLSearchParams(searchParams.toString());
    
    // Update or remove query params based on filter values
    if (filters.active !== undefined) {
      params.set('active', filters.active.toString());
    } else {
      params.delete('active');
    }
    
    if (filters.campus_id) {
      params.set('campus_id', filters.campus_id);
    } else {
      params.delete('campus_id');
    }
    
    if (filters.type) {
      params.set('type', filters.type);
    } else {
      params.delete('type');
    }
    
    if (filters.searchTerm) {
      params.set('search', filters.searchTerm);
    } else {
      params.delete('search');
    }
    
    // Preserve sort parameter
    if (sortOrder) {
      params.set('sort', sortOrder);
    }
    
    // Only update if needed to avoid unnecessary history entries
    const newQueryString = params.toString();
    const currentQueryString = searchParams.toString();
    
    if (newQueryString !== currentQueryString) {
      // Wrap router navigation in a transition to prevent UI freezing
      startTransition(() => {
        router.push(`${pathname}?${newQueryString}`);
      });
    }
  }, [filters, isPending, router, pathname, searchParams, sortOrder]);
  
  // Sort options
  const sortOptions: SortOption[] = [
    { label: 'Name (A-Z)', value: 'name-asc' },
    { label: 'Name (Z-A)', value: 'name-desc' },
    { label: 'Campus (A-Z)', value: 'campus-asc' },
    { label: 'Campus (Z-A)', value: 'campus-desc' },
    { label: 'Most Members', value: 'users-desc' },
    { label: 'Fewest Members', value: 'users-asc' },
  ];
  
  // Current sort option
  const currentSort = sortOptions.find(opt => opt.value === sortOrder) || sortOptions[0];
  
  // Update sort order
  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    router.push(`${pathname}?${params.toString()}`);
  };
  
  // Handle edit department
  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
  };
  
  // Handle data refresh
  const handleDataRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <DepartmentFilters
          filters={filters}
          isPending={isPending}
          updateFilter={updateFilter}
          resetFilters={resetFilters}
          setSearchTerm={setSearchTerm}
          campuses={campuses}
          types={types}
        />
        
        <div className="hidden md:flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <ArrowUpDown className="h-4 w-4" />
                Sort: {currentSort.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Sort Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleSortChange(option.value)}
                  className="flex justify-between cursor-pointer"
                >
                  {option.label}
                  {option.value === sortOrder && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            Add Unit
          </Button>
        </div>
      </div>
      
      {/* Mobile add button */}
      <div className="md:hidden flex justify-end">
        <Button onClick={() => setIsCreateModalOpen(true)} size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          Add Unit
        </Button>
      </div>
      
      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {departments.length} {departments.length === 1 ? 'department' : 'departments'}
      </div>
      
      {/* Grid of department cards */}
      {departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
          <div className="text-muted-foreground">No departments found</div>
          <Button 
            variant="outline" 
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add First Department
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {departments.map((department) => (
            <DepartmentCard
              key={department.$id}
              department={department}
              onEdit={handleEditDepartment}
            />
          ))}
        </div>
      )}
      
      {/* Edit Dialog */}
      {editingDepartment && (
        <DepartmentEditDialog
          department={editingDepartment}
          open={!!editingDepartment}
          onOpenChange={(open) => {
            if (!open) setEditingDepartment(undefined);
          }}
          onSuccess={handleDataRefresh}
          campuses={campuses}
          types={types}
        />
      )}
      
      {/* Create Dialog */}
      <DepartmentEditDialog
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleDataRefresh}
        campuses={campuses}
        types={types}
      />
    </div>
  );
}