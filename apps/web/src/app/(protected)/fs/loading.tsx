import { ExpenseListSkeleton } from "@/components/expense/expense-skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Header Skeleton */}
      <div className="relative h-[50vh] bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90 animate-pulse" />

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
        </div>

        <ExpenseListSkeleton />
      </div>
    </div>
  );
}
