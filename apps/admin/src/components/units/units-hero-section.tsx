"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Building2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

type UnitsHeroSectionProps = {
  totalDepartments: number;
  campusOptions: Array<{ id: string; name: string }>;
};

export function UnitsHeroSection({
  totalDepartments,
  campusOptions,
}: UnitsHeroSectionProps) {
  const router = useRouter();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary via-primary/95 to-accent p-8 shadow-2xl md:p-12">
      {/* Gradient overlay with pattern */}
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-size-[20px_20px]" />
      <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />

      {/* Floating orbs for visual interest */}
      <div className="absolute top-0 right-0 h-72 w-72 animate-pulse rounded-full bg-accent/30 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-96 w-96 animate-pulse rounded-full bg-primary/30 blur-3xl delay-700" />

      <div className="relative z-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/20 bg-white/10 p-2.5 backdrop-blur-sm">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <h1 className="font-bold text-3xl text-white tracking-tight md:text-4xl">
                Units Management
              </h1>
            </div>
            <p className="max-w-2xl text-lg text-white/90 leading-relaxed">
              Manage all departments across {campusOptions.length} campuses.
              <span className="font-semibold"> {totalDepartments} units</span>{" "}
              are currently in the system.
            </p>
          </div>

          <Button
            className={cn(
              "bg-white text-primary shadow-xl hover:bg-white/90 hover:shadow-2xl",
              "font-semibold transition-all duration-300 hover:scale-105",
              "group relative overflow-hidden"
            )}
            onClick={() => router.push("/admin/units/new")}
            size="lg"
          >
            <div className="-translate-x-full absolute inset-0 bg-linear-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-1000 group-hover:translate-x-full" />
            <Plus className="mr-2 h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
            Create New Unit
          </Button>
        </div>
      </div>
    </div>
  );
}
