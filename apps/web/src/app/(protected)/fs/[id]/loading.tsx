import { ExpenseDetailSkeleton } from "@/components/expense/expense-skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      {/* Header Skeleton */}
      <div className="relative h-[30vh] animate-pulse bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-12">
        <ExpenseDetailSkeleton />
      </div>
    </div>
  );
}
