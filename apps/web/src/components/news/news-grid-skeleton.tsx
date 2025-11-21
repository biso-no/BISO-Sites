import { Card } from "@repo/ui/components/ui/card";

export function NewsGridSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Featured Articles Skeleton */}
      <div className="mb-16">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-gray-200" />
          <div className="h-8 w-48 rounded bg-gray-200" />
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card
              className="flex h-full flex-col overflow-hidden border-0 shadow-2xl"
              key={i}
            >
              <div className="h-80 bg-gray-200" />
              <div className="flex flex-1 flex-col space-y-4 p-6">
                <div className="h-6 w-3/4 rounded bg-gray-200" />
                <div className="h-4 w-full flex-1 rounded bg-gray-200" />
                <div className="h-4 w-full rounded bg-gray-200" />
                <div className="flex items-center justify-between pt-4">
                  <div className="h-4 w-20 rounded bg-gray-200" />
                  <div className="h-10 w-32 rounded bg-gray-200" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Regular Articles Skeleton */}
      <div>
        <div className="mb-8 flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-gray-200" />
          <div className="h-8 w-40 rounded bg-gray-200" />
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card
              className="flex h-full flex-col overflow-hidden border-0 shadow-lg"
              key={i}
            >
              <div className="h-56 bg-gray-200" />
              <div className="flex flex-1 flex-col space-y-3 p-6">
                <div className="h-5 w-3/4 rounded bg-gray-200" />
                <div className="h-4 w-full flex-1 rounded bg-gray-200" />
                <div className="h-4 w-full rounded bg-gray-200" />
                <div className="space-y-2 pt-2">
                  <div className="h-4 w-32 rounded bg-gray-200" />
                  <div className="h-4 w-28 rounded bg-gray-200" />
                  <div className="flex items-center justify-between border-gray-100 border-t pt-2">
                    <div className="h-4 w-16 rounded bg-gray-200" />
                    <div className="h-8 w-24 rounded bg-gray-200" />
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
