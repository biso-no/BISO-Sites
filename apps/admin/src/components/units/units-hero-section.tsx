"use client";

import { Building2, Plus } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
import { useRouter } from 'next/navigation';
import { cn } from '@repo/ui/lib/utils';

interface UnitsHeroSectionProps {
  totalDepartments: number;
  campusOptions: Array<{ id: string; name: string }>;
}

export function UnitsHeroSection({ totalDepartments, campusOptions }: UnitsHeroSectionProps) {
  const router = useRouter();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary via-primary/95 to-accent p-8 md:p-12 shadow-2xl">
      {/* Gradient overlay with pattern */}
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-size-[20px_20px]" />
      <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />

      {/* Floating orbs for visual interest */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-accent/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse delay-700" />

      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Units Management
              </h1>
            </div>
            <p className="text-white/90 text-lg max-w-2xl leading-relaxed">
              Manage all departments across {campusOptions.length} campuses. 
              <span className="font-semibold"> {totalDepartments} units</span> are currently in the system.
            </p>
          </div>

          <Button
            size="lg"
            onClick={() => router.push('/admin/units/new')}
            className={cn(
              "bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl",
              "transition-all duration-300 hover:scale-105 font-semibold",
              "group relative overflow-hidden"
            )}
          >
            <div className="absolute inset-0 bg-linear-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <Plus className="h-5 w-5 mr-2 transition-transform group-hover:rotate-90 duration-300" />
            Create New Unit
          </Button>
        </div>
      </div>
    </div>
  );
}

