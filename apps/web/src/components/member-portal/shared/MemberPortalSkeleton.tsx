import { Card } from '@repo/ui/components/ui/card'
import { Skeleton } from '@repo/ui/components/ui/skeleton'

export function MemberPortalSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header Skeleton */}
      <div className="bg-linear-to-r from-[#001731] to-[#3DA9E0] text-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <Skeleton className="h-10 w-32 mb-6 bg-white/20" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="w-20 h-20 rounded-full bg-white/20" />
              <div>
                <Skeleton className="h-8 w-64 mb-2 bg-white/20" />
                <Skeleton className="h-5 w-48 bg-white/20" />
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <Skeleton className="h-20 w-48 rounded-lg bg-white/20" />
              <Skeleton className="h-20 w-48 rounded-lg bg-white/20" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Skeleton className="h-12 w-full mb-8 dark:bg-gray-800" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6 dark:bg-gray-900/50">
              <Skeleton className="h-12 w-12 mb-4 dark:bg-gray-800" />
              <Skeleton className="h-6 w-32 mb-2 dark:bg-gray-800" />
              <Skeleton className="h-4 w-24 dark:bg-gray-800" />
            </Card>
          ))}
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 dark:bg-gray-900/50">
              <Skeleton className="h-48 w-full mb-4 dark:bg-gray-800" />
              <Skeleton className="h-6 w-full mb-2 dark:bg-gray-800" />
              <Skeleton className="h-4 w-3/4 dark:bg-gray-800" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
