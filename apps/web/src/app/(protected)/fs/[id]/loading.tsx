import { ExpenseDetailSkeleton } from "@/components/expense/expense-skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Header Skeleton */}
      <div className="relative h-[30vh] bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90 animate-pulse" />

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ExpenseDetailSkeleton />
      </div>
    </div>
  );
}
