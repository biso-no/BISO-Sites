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
    <section className="py-24 bg-linear-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-6 border rounded-lg">
              <Skeleton className="w-12 h-12 mx-auto mb-4 rounded-full" />
              <Skeleton className="h-8 w-20 mx-auto mb-1" />
              <Skeleton className="h-4 w-16 mx-auto" />
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <Skeleton className="h-10 w-32 mb-6" />
            <Skeleton className="h-12 w-full mb-4" />
            <Skeleton className="h-12 w-3/4 mb-6" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-6" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="aspect-square rounded-2xl" />
        </div>

        {/* Values */}
        <div className="grid md:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-8 border rounded-lg">
              <Skeleton className="w-16 h-16 mb-6 rounded-2xl" />
              <Skeleton className="h-6 w-3/4 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
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
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <Skeleton className="h-10 w-40 mx-auto mb-6 rounded-full" />
          <Skeleton className="h-12 w-96 mx-auto mb-4" />
          <Skeleton className="h-12 w-80 mx-auto mb-6" />
          <Skeleton className="h-4 w-[600px] mx-auto" />
        </div>

        {/* Events Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={i === 0 ? "md:col-span-2" : ""}>
              <div className="border rounded-lg overflow-hidden">
                <Skeleton className={i === 0 ? "h-96" : "h-64"} />
                <div className="p-8">
                  <Skeleton className="h-8 w-3/4 mb-4" />
                  <div className="space-y-3 mb-6">
                    {[...Array(4)].map((_, j) => (
                      <Skeleton key={j} className="h-5 w-full" />
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
          <Skeleton className="h-12 w-48 mx-auto" />
        </div>
      </div>
    </section>
  );
}

export function NewsSkeleton() {
  return (
    <section className="py-24 bg-linear-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <Skeleton className="h-10 w-32 mx-auto mb-6 rounded-full" />
          <Skeleton className="h-12 w-96 mx-auto mb-4" />
          <Skeleton className="h-12 w-80 mx-auto" />
        </div>

        {/* Featured News */}
        <div className="mb-8">
          <div className="border rounded-lg overflow-hidden">
            <div className="grid md:grid-cols-2 gap-0">
              <Skeleton className="h-96" />
              <div className="p-12 flex flex-col justify-center">
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-full mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6 mb-6" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </div>
        </div>

        {/* Other News */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="border rounded-lg overflow-hidden">
              <Skeleton className="h-56" />
              <div className="p-6">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-6 w-full mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-4/5 mb-4" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center">
          <Skeleton className="h-12 w-48 mx-auto" />
        </div>
      </div>
    </section>
  );
}
