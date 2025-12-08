export default function Loading() {
 return (
 <div className="min-h-screen bg-linear-to-b from-section to-background">
 {/* Header Skeleton */}
 <div className="relative h-[30vh] animate-pulse bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

 {/* Content */}
 <div className="mx-auto max-w-4xl px-4 py-8">
 <div className="animate-pulse rounded-lg bg-background p-8 shadow-xl">
 <div className="mb-6 h-8 w-48 rounded bg-muted" />
 <div className="space-y-4">
 <div className="h-12 rounded bg-muted" />
 <div className="h-12 rounded bg-muted" />
 <div className="h-12 rounded bg-muted" />
 </div>
 </div>
 </div>
 </div>
 );
}
