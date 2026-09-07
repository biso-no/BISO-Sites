export default function DepartmentLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Skeleton */}
      <div className="relative h-[60vh] animate-pulse overflow-hidden bg-muted/50" />

      {/* Tabs Skeleton */}
      <div className="sticky top-0 z-40 border-border border-b bg-background">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-4 gap-6 py-4">
            {[...new Array(4)].map((_, i) => (
              <div className="h-12 animate-pulse rounded-md bg-muted" key={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="space-y-8">
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-6 md:grid-cols-3">
            {[...new Array(3)].map((_, i) => (
              <div className="h-48 animate-pulse rounded-lg bg-muted" key={i} />
            ))}
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[...new Array(6)].map((_, i) => (
              <div
                className="h-[400px] animate-pulse rounded-lg bg-muted"
                key={i}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
