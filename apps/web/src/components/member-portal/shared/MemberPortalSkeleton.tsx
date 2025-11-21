import { Card } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function MemberPortalSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header Skeleton */}
      <div className="bg-linear-to-r from-[#001731] to-[#3DA9E0] py-8 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <Skeleton className="mb-6 h-10 w-32 bg-white/20" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full bg-white/20" />
              <div>
                <Skeleton className="mb-2 h-8 w-64 bg-white/20" />
                <Skeleton className="h-5 w-48 bg-white/20" />
              </div>
            </div>
            <div className="hidden items-center gap-4 md:flex">
              <Skeleton className="h-20 w-48 rounded-lg bg-white/20" />
              <Skeleton className="h-20 w-48 rounded-lg bg-white/20" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="mb-8 h-12 w-full dark:bg-gray-800" />
        <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card className="p-6 dark:bg-gray-900/50" key={i}>
              <Skeleton className="mb-4 h-12 w-12 dark:bg-gray-800" />
              <Skeleton className="mb-2 h-6 w-32 dark:bg-gray-800" />
              <Skeleton className="h-4 w-24 dark:bg-gray-800" />
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card className="p-6 dark:bg-gray-900/50" key={i}>
              <Skeleton className="mb-4 h-48 w-full dark:bg-gray-800" />
              <Skeleton className="mb-2 h-6 w-full dark:bg-gray-800" />
              <Skeleton className="h-4 w-3/4 dark:bg-gray-800" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
