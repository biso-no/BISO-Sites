import { Suspense } from "react";
import { getDepartments } from "@/lib/actions/departments";
import { getLocale } from "@/app/actions/locale";
import { DepartmentsHero } from "./components/departments-hero";
import { DepartmentsListClient } from "./components/departments-list-client";
import { DepartmentsCTA } from "./components/departments-cta";

export const revalidate = 0;

async function DepartmentsContent() {
  const locale = await getLocale();
  
  // Fetch all active departments with relationships
  const departments = await getDepartments({ isActive: true, locale });

  // Extract unique types dynamically from department_ref
  const availableTypes = [
    ...new Set(
      departments
        .map(d => d.department_ref?.type)
        .filter((type): type is string => Boolean(type))
    )
  ].sort();

  // Calculate stats
  const stats = {
    totalDepartments: departments.length,
    totalMembers: departments.reduce((sum, dept) => 
      sum + (dept.department_ref?.boardMembers?.length || 0), 0
    ),
    totalCampuses: new Set(
      departments.map(d => d.department_ref?.campus_id).filter(Boolean)
    ).size,
  };

  return (
    <>
      {/* Hero Section */}
      <DepartmentsHero stats={stats} />

      {/* Filters with overlap */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-10 mb-12">
        <DepartmentsListClient 
          departments={departments}
          availableTypes={availableTypes}
        />
      </div>

      {/* Call to Action */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <DepartmentsCTA />
      </div>
    </>
  );
}

export default async function UnitsPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Suspense fallback={<UnitsPageSkeleton />}>
        <DepartmentsContent />
      </Suspense>
    </div>
  );
}

function UnitsPageSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Hero Skeleton */}
      <div className="relative h-[50vh] overflow-hidden bg-muted/50 animate-pulse isolate" />
      
      {/* Filters Skeleton with overlap */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-10 mb-12">
        <div className="p-6 border-0 shadow-xl bg-card rounded-lg relative z-10">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="h-12 bg-muted animate-pulse rounded-md" />
            <div className="h-12 bg-muted animate-pulse rounded-md" />
            <div className="h-12 bg-muted animate-pulse rounded-md" />
          </div>
        </div>

        {/* Results count skeleton */}
        <div className="mt-8 space-y-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
          <div className="h-5 w-96 bg-muted animate-pulse rounded-md" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-[400px] bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>

      {/* CTA Skeleton */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
