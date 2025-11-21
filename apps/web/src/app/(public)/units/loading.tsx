export default function UnitsLoading() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Hero Skeleton */}
      <div className="relative h-[50vh] overflow-hidden bg-muted/50 animate-pulse isolate" />

      {/* Filters Skeleton with overlap */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-10 mb-12">
        <div className="p-6 border-0 shadow-xl bg-card rounded-lg relative z-10">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="h-12 bg-muted animate-pulse rounded-md" />
            <div className="h-12 bg-muted animate-pulse rounded-md" />
            <div className="h-12 bg-muted animate-pulse rounded-md" />
          </div>
        </div>

        {/* Results count skeleton */}
        <div className="mt-8 space-y-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
          <div className="h-5 w-96 bg-muted animate-pulse rounded-md" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-[400px] bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>

      {/* CTA Skeleton */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
