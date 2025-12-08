import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function HeroSkeleton() {
  return (
    <div className="relative h-screen w-full">
      <Skeleton className="absolute inset-0" />
    </div>
  );
}

export function AboutSkeleton() {
  return (
    <section className="bg-linear-to-b from-section to-background py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="mb-20 grid grid-cols-2 gap-6 md:grid-cols-4">
          {[...new Array(4)].map((_, i) => (
            <div className="rounded-lg border p-6" key={i}>
              <Skeleton className="mx-auto mb-4 h-12 w-12 rounded-full" />
              <Skeleton className="mx-auto mb-1 h-8 w-20" />
              <Skeleton className="mx-auto h-4 w-16" />
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="mb-20 grid items-center gap-16 md:grid-cols-2">
          <div>
            <Skeleton className="mb-6 h-10 w-32" />
            <Skeleton className="mb-4 h-12 w-full" />
            <Skeleton className="mb-6 h-12 w-3/4" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="mb-6 h-4 w-3/4" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="aspect-square rounded-2xl" />
        </div>

        {/* Values */}
        <div className="grid gap-8 md:grid-cols-3">
          {[...new Array(3)].map((_, i) => (
            <div className="rounded-lg border p-8" key={i}>
              <Skeleton className="mb-6 h-16 w-16 rounded-2xl" />
              <Skeleton className="mb-3 h-6 w-3/4" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EventsSkeleton() {
  return (
    <section className="bg-background py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <Skeleton className="mx-auto mb-6 h-10 w-40 rounded-full" />
          <Skeleton className="mx-auto mb-4 h-12 w-96" />
          <Skeleton className="mx-auto mb-6 h-12 w-80" />
          <Skeleton className="mx-auto h-4 w-[600px]" />
        </div>

        {/* Events Grid */}
        <div className="mb-12 grid gap-8 md:grid-cols-2">
          {[...new Array(4)].map((_, i) => (
            <div className={i === 0 ? "md:col-span-2" : ""} key={i}>
              <div className="overflow-hidden rounded-lg border">
                <Skeleton className={i === 0 ? "h-96" : "h-64"} />
                <div className="p-8">
                  <Skeleton className="mb-4 h-8 w-3/4" />
                  <div className="mb-6 space-y-3">
                    {[...new Array(4)].map((__, j) => (
                      <Skeleton className="h-5 w-full" key={j} />
                    ))}
                  </div>
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center">
          <Skeleton className="mx-auto h-12 w-48" />
        </div>
      </div>
    </section>
  );
}

export function NewsSkeleton() {
  return (
    <section className="bg-linear-to-b from-background to-section py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <Skeleton className="mx-auto mb-6 h-10 w-32 rounded-full" />
          <Skeleton className="mx-auto mb-4 h-12 w-96" />
          <Skeleton className="mx-auto h-12 w-80" />
        </div>

        {/* Featured News */}
        <div className="mb-8">
          <div className="overflow-hidden rounded-lg border">
            <div className="grid gap-0 md:grid-cols-2">
              <Skeleton className="h-96" />
              <div className="flex flex-col justify-center p-12">
                <Skeleton className="mb-4 h-4 w-24" />
                <Skeleton className="mb-4 h-8 w-full" />
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="mb-6 h-4 w-5/6" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </div>
        </div>

        {/* Other News */}
        <div className="mb-12 grid gap-8 md:grid-cols-2">
          {[...new Array(2)].map((_, i) => (
            <div className="overflow-hidden rounded-lg border" key={i}>
              <Skeleton className="h-56" />
              <div className="p-6">
                <Skeleton className="mb-3 h-4 w-20" />
                <Skeleton className="mb-3 h-6 w-full" />
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="mb-4 h-4 w-4/5" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center">
          <Skeleton className="mx-auto h-12 w-48" />
        </div>
      </div>
    </section>
  );
}
