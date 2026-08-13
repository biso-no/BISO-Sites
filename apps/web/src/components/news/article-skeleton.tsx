import { Skeleton } from "@repo/ui/components/ui/skeleton";

/** Mirrors the article layout so the pull-up card does not jump on hydration. */
export function ArticleSkeleton() {
  return (
    <div className="bg-background">
      <div className="bg-brand-dark px-4 pt-28 pb-28 sm:px-6 lg:px-8 lg:pt-36 lg:pb-36">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-4 w-28 bg-white/10" />
          <Skeleton className="h-5 w-40 bg-white/10" />
          <Skeleton className="h-12 w-full max-w-2xl bg-white/10" />
          <Skeleton className="h-12 w-2/3 max-w-xl bg-white/10" />
          <Skeleton className="h-5 w-full max-w-lg bg-white/10" />
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-16 max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-10 lg:p-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-16">
            <div className="space-y-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full max-w-xs" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-7 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
