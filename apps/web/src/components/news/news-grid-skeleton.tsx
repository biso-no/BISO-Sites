import { Card } from "@repo/ui/components/ui/card";

export function NewsGridSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Featured Articles Skeleton */}
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1 h-8 bg-gray-200 rounded-full" />
          <div className="h-8 w-48 bg-gray-200 rounded" />
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {[1, 2].map((i) => (
            <Card
              key={i}
              className="overflow-hidden border-0 shadow-2xl h-full flex flex-col"
            >
              <div className="h-80 bg-gray-200" />
              <div className="p-6 space-y-4 flex-1 flex flex-col">
                <div className="h-6 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-full flex-1" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="flex items-center justify-between pt-4">
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                  <div className="h-10 w-32 bg-gray-200 rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Regular Articles Skeleton */}
      <div>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1 h-8 bg-gray-200 rounded-full" />
          <div className="h-8 w-40 bg-gray-200 rounded" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card
              key={i}
              className="overflow-hidden border-0 shadow-lg h-full flex flex-col"
            >
              <div className="h-56 bg-gray-200" />
              <div className="p-6 space-y-3 flex-1 flex flex-col">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-full flex-1" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="space-y-2 pt-2">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-200 rounded w-28" />
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="h-4 w-16 bg-gray-200 rounded" />
                    <div className="h-8 w-24 bg-gray-200 rounded" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
