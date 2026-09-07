import {
  parseUnitCategory,
  UNIT_CATEGORIES,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { getDepartments } from "@/lib/actions/departments";
import { DepartmentsCTA } from "./components/departments-cta";
import { DepartmentsHero } from "./components/departments-hero";
import { DepartmentsListClient } from "./components/departments-list-client";

export const metadata: Metadata = {
  title: "BISO Units & Departments | BI Student Organisation",
  description:
    "Explore the student-run units and departments that make up BISO across BI Norwegian Business School campuses.",
};

async function DepartmentsContent() {
  const locale = await getLocale();

  // Fetch all active departments with relationships
  const departments = await getDepartments({ isActive: true, locale });

  // Derive the categories actually present in the loaded units. `departments.type`
  // is free text and largely unpopulated, so options come from the data rather
  // than from a static list that would mostly yield zero results.
  const presentCategories = new Set<UnitCategory>();
  for (const dept of departments) {
    const category = parseUnitCategory(dept.department_ref?.type);
    if (category) {
      presentCategories.add(category);
    }
  }
  const availableCategories = UNIT_CATEGORIES.filter((value) =>
    presentCategories.has(value)
  );

  // Calculate stats
  const stats = {
    totalDepartments: departments.length,
    totalMembers: departments.reduce(
      (sum, dept) => sum + (dept.department_ref?.boardMembers?.length || 0),
      0
    ),
    totalCampuses: new Set(
      departments.map((d) => d.department_ref?.campus_id).filter(Boolean)
    ).size,
  };

  return (
    <>
      {/* Hero Section */}
      <DepartmentsHero stats={stats} />

      {/* Filters with overlap */}
      <div className="relative z-10 mx-auto -mt-8 mb-12 max-w-7xl px-4">
        <DepartmentsListClient
          availableCategories={availableCategories}
          departments={departments}
        />
      </div>

      {/* Call to Action */}
      <div className="mx-auto max-w-7xl px-4 pb-16">
        <DepartmentsCTA />
      </div>
    </>
  );
}

export default function UnitsPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background dark:from-card dark:to-background">
      <Suspense fallback={<UnitsPageSkeleton />}>
        <DepartmentsContent />
      </Suspense>
    </div>
  );
}

function UnitsPageSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background dark:from-card dark:to-background">
      {/* Hero Skeleton */}
      <div className="relative isolate h-[50vh] animate-pulse overflow-hidden bg-muted/50" />

      {/* Filters Skeleton with overlap */}
      <div className="relative z-10 mx-auto -mt-8 mb-12 max-w-7xl px-4">
        <div className="relative z-10 rounded-lg border-0 bg-card p-6 shadow-xl">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-12 animate-pulse rounded-md bg-muted" />
            <div className="h-12 animate-pulse rounded-md bg-muted" />
            <div className="h-12 animate-pulse rounded-md bg-muted" />
          </div>
        </div>

        {/* Results count skeleton */}
        <div className="mt-8 space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-5 w-96 animate-pulse rounded-md bg-muted" />
        </div>

        {/* Grid Skeleton */}
        <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[...new Array(6)].map((_, i) => (
            <div
              className="h-[400px] animate-pulse rounded-lg bg-muted"
              key={i}
            />
          ))}
        </div>
      </div>

      {/* CTA Skeleton */}
      <div className="mx-auto max-w-7xl px-4 pb-16">
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
