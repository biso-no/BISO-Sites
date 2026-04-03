"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Plus, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { AdminSummary } from "@/components/admin/admin-summary";

type UnitsHeroSectionProps = {
  totalDepartments: number;
  campusOptions: Array<{ id: string; name: string }>;
};

export function UnitsHeroSection({
  totalDepartments,
  campusOptions,
}: UnitsHeroSectionProps) {
  const router = useRouter();

  const handleSync = async () => {
    const response = await fetch("/api/units/sync");
    const data = await response.json();
    console.log(data);
  };

  return (
    <AdminSummary
      badge="Management"
      title="Units"
      description={
        <>
          Manage all departments across {campusOptions.length} campuses.{" "}
          <span className="font-semibold">{totalDepartments} units</span> are
          currently in the system.
        </>
      }
      action={
        <Button
          className="group gap-2"
          onClick={handleSync}
          size="lg"
        >
          <RefreshCcw className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
          Sync Units
        </Button>
      }
    />
  );
}
