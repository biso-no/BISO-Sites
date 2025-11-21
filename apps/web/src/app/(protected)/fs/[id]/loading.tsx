import { ExpenseDetailSkeleton } from "@/components/expense/expense-skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Header Skeleton */}
      <div className="relative h-[30vh] animate-pulse bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-12">
        <ExpenseDetailSkeleton />
      </div>
    </div>
  );
}
