import { ExpenseListSkeleton } from "@/components/expense/expense-skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Header Skeleton */}
      <div className="relative h-[50vh] animate-pulse bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8">
          <div className="mb-2 h-8 w-64 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-96 animate-pulse rounded bg-gray-200" />
        </div>

        <ExpenseListSkeleton />
      </div>
    </div>
  );
}
