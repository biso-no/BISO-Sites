import { Card } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function MemberPortalSkeleton() {
 return (
 <div className="min-h-screen bg-linear-to-b from-section to-background dark:from-background dark:to-card">
 {/* Header Skeleton */}
 <div className="bg-linear-to-r from-brand-gradient-to to-brand-gradient-from py-8 text-white">
 <div className="mx-auto max-w-7xl px-4">
 <Skeleton className="mb-6 h-10 w-32 bg-background/20" />
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <Skeleton className="h-20 w-20 rounded-full bg-background/20" />
 <div>
 <Skeleton className="mb-2 h-8 w-64 bg-background/20" />
 <Skeleton className="h-5 w-48 bg-background/20" />
 </div>
 </div>
 <div className="hidden items-center gap-4 md:flex">
 <Skeleton className="h-20 w-48 rounded-lg bg-background/20" />
 <Skeleton className="h-20 w-48 rounded-lg bg-background/20" />
 </div>
 </div>
 </div>
 </div>

 {/* Content Skeleton */}
 <div className="mx-auto max-w-7xl px-4 py-8">
 <Skeleton className="mb-8 h-12 w-full dark:bg-inverted" />
 <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
 {[1, 2, 3, 4].map((i) => (
 <Card className="p-6 dark:bg-inverted/50" key={i}>
 <Skeleton className="mb-4 h-12 w-12 dark:bg-inverted" />
 <Skeleton className="mb-2 h-6 w-32 dark:bg-inverted" />
 <Skeleton className="h-4 w-24 dark:bg-inverted" />
 </Card>
 ))}
 </div>
 <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
 {[1, 2, 3].map((i) => (
 <Card className="p-6 dark:bg-inverted/50" key={i}>
 <Skeleton className="mb-4 h-48 w-full dark:bg-inverted" />
 <Skeleton className="mb-2 h-6 w-full dark:bg-inverted" />
 <Skeleton className="h-4 w-3/4 dark:bg-inverted" />
 </Card>
 ))}
 </div>
 </div>
 </div>
 );
}
