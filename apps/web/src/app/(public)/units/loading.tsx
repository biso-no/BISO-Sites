export default function UnitsLoading() {
 return (
 <div className="min-h-screen bg-linear-to-b from-section to-background dark:from-card dark:to-background">
 {/* Hero Skeleton */}
 <div className="relative isolate h-[50vh] animate-pulse overflow-hidden bg-muted/50" />

 {/* Filters Skeleton with overlap */}
 <div className="-mt-8 relative z-10 mx-auto mb-12 max-w-7xl px-4">
 <div className="relative z-10 rounded-lg border-0 bg-card p-6 shadow-xl">
 <div className="grid gap-4 md:grid-cols-3">
 <div className="h-12 animate-pulse rounded-md bg-muted" />
 <div className="h-12 animate-pulse rounded-md bg-muted" />
 <div className="h-12 animate-pulse rounded-md bg-muted" />
 </div>
 </div>

 {/* Results count skeleton */}
 <div className="mt-8 space-y-2">
 <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
 <div className="h-5 w-96 animate-pulse rounded-md bg-muted" />
 </div>

 {/* Grid Skeleton */}
 <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
 {[...new Array(6)].map((_, i) => (
 <div
 className="h-[400px] animate-pulse rounded-lg bg-muted"
 key={i}
 />
 ))}
 </div>
 </div>

 {/* CTA Skeleton */}
 <div className="mx-auto max-w-7xl px-4 pb-16">
 <div className="h-64 animate-pulse rounded-lg bg-muted" />
 </div>
 </div>
 );
}
