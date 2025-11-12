"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { ArrowUpDown, Plus, Check } from 'lucide-react';
import { DepartmentEditDialog } from './department-edit-dialog';
import { useUrlUpdate } from '@/lib/hooks/use-url-update';

interface DepartmentActionsHeaderProps {
  sortOrder: string;
  campuses: Array<{ id: string; name: string }>;
  types: string[];
}

const sortOptions = [
  { label: 'Name (A-Z)', value: 'name-asc' },
  { label: 'Name (Z-A)', value: 'name-desc' },
  { label: 'Campus (A-Z)', value: 'campus-asc' },
  { label: 'Campus (Z-A)', value: 'campus-desc' },
  { label: 'Most Members', value: 'users-desc' },
  { label: 'Fewest Members', value: 'users-asc' },
];

export function DepartmentActionsHeader({ 
  sortOrder,
  campuses,
  types
}: DepartmentActionsHeaderProps) {
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const updateUrl = useUrlUpdate(0); // No debounce for sort changes
  
  // Current sort option
  const currentSort = sortOptions.find(opt => opt.value === sortOrder) || sortOptions[0];
  
  // Update sort order
  const handleSortChange = (value: string) => {
    updateUrl({ sort: value });
  };

  return (
    <>
      <div className="flex gap-2">
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

      {/* Create Dialog */}
      <DepartmentEditDialog
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          router.refresh();
        }}
        campuses={campuses}
        types={types}
      />
    </>
  );
} 