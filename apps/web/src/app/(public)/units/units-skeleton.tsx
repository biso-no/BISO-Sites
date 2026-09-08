const SECTION_SHELL = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";
/** Stable keys: the placeholder list is fixed-length and never reorders. */
const PLACEHOLDER_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/** Mirrors the real layout's rhythm so the swap doesn't shift the page. */
export function UnitsSkeleton() {
  return (
    <>
      <div className="h-[35vh] min-h-[280px] animate-pulse bg-muted/60" />
      <div className={`${SECTION_SHELL} py-10`}>
        <div className="mb-8 flex gap-3">
          <div className="h-10 w-32 animate-pulse rounded-full bg-muted" />
          <div className="h-10 w-32 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PLACEHOLDER_KEYS.map((key) => (
            <div className="h-48 animate-pulse rounded-xl bg-muted" key={key} />
          ))}
        </div>
      </div>
    </>
  );
}
