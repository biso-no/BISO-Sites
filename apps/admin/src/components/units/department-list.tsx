"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Department } from '@/lib/admin/departments';
import { DepartmentCard } from './department-card';
import { DepartmentEditDialog } from './department-edit-dialog';
import { Button } from '@repo/ui/components/ui/button';
import { Plus } from 'lucide-react';

interface DepartmentListProps {
  departments: Department[];
  campuses: Array<{ id: string; name: string }>;
  types: string[];
}

export function DepartmentList({
  departments,
  campuses,
  types,
}: DepartmentListProps) {
  const router = useRouter();
  const [editingDepartment, setEditingDepartment] = useState<Department | undefined>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
  };

  const handleDataRefresh = () => {
    router.refresh();
  };

  if (departments.length === 0) {
    return (
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

        <DepartmentEditDialog
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            handleDataRefresh();
          }}
          campuses={campuses}
          types={types}
        />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {departments.map((department) => (
          <DepartmentCard
            key={department.$id}
            department={department}
            onEdit={handleEditDepartment}
          />
        ))}
      </div>
    </>
  );
} 