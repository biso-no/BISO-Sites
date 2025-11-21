import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { getDepartmentById } from "@/lib/actions/departments";
import { getLoggedInUser } from "@/lib/actions/user";
import { DepartmentHero } from "./components/department-hero";
import { DepartmentTabsClient } from "./components/department-tabs-client";

export const revalidate = 0;

async function DepartmentDetailsContent({ id }: { id: string }) {
  const locale = await getLocale();
  const department = await getDepartmentById(id, locale);

  if (!department || !department.department_ref?.active) {
    notFound();
  }

  // Get member status if user is logged in
  const user = await getLoggedInUser();
  const isMember = user?.profile?.studentId?.isMember || false;

  return (
    <>
      <DepartmentHero department={department} />
      <DepartmentTabsClient department={department} isMember={isMember} />
    </>
  );
}

function DepartmentDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Skeleton */}
      <div className="relative h-[60vh] overflow-hidden bg-muted/50 animate-pulse" />

      {/* Tabs Skeleton */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6 py-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-10 w-32 bg-muted animate-pulse rounded-md"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="space-y-8">
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
          <div className="grid md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<DepartmentDetailsSkeleton />}>
        <DepartmentDetailsContent id={id} />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const locale = await getLocale();
  const department = await getDepartmentById(id, locale);

  if (!department) {
    return {
      title: "Department Not Found",
    };
  }

  return {
    title: `${department.title} | BISO`,
    description:
      department.short_description ||
      department.description ||
      `Learn more about ${department.title} at BISO`,
  };
}
