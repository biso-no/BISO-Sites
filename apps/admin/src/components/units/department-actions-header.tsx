"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

interface DepartmentActionsHeaderProps {
  sortOrder?: string;
  campuses: Array<{ id: string; name: string }>;
  types: string[];
}

export function DepartmentActionsHeader({
  campuses,
  types,
}: DepartmentActionsHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex gap-2">
      <Button onClick={() => router.push("/admin/units/new")} className="gap-2">
        <Plus className="h-4 w-4" />
        Add Unit
      </Button>
    </div>
  );
}
