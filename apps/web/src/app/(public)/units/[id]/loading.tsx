export default function DepartmentLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Skeleton */}
      <div className="relative h-[60vh] overflow-hidden bg-muted/50 animate-pulse" />
      
      {/* Tabs Skeleton */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-4 gap-6 py-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="space-y-8">
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
          <div className="grid md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[400px] bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
