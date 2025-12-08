import { ExpenseListSkeleton } from "@/components/expense/expense-skeleton";

export default function Loading() {
 return (
 <div className="min-h-screen bg-linear-to-b from-section to-background">
 {/* Header Skeleton */}
 <div className="relative h-[50vh] animate-pulse bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

 {/* Content */}
 <div className="mx-auto max-w-6xl px-4 py-12">
 <div className="mb-8">
 <div className="mb-2 h-8 w-64 animate-pulse rounded bg-muted" />
 <div className="h-4 w-96 animate-pulse rounded bg-muted" />
 </div>

 <ExpenseListSkeleton />
 </div>
 </div>
 );
}
