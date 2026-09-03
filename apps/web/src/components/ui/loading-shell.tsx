import { CardGrid } from "./card-grid";
import { Section } from "./section";

/**
 * Loading shells that look like the page they precede.
 *
 * Under PPR the fallback is what the visitor sees on the first flush, so a
 * skeleton is not a detail — it is the page for the first few hundred
 * milliseconds. The v2 routes were still falling back to the v1 skeletons,
 * which are built from the old palette (`from-section to-background`,
 * `bg-primary/10`) and the old layout, so every feed opened with a flash of the
 * design being replaced and then reflowed.
 *
 * Blocks are `--surface-sunken` rather than an animated pulse: `animate-pulse`
 * runs regardless of `prefers-reduced-motion`, and a still block placed where
 * the content will be says the same thing without moving.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-biso-sm bg-surface-sunken ${className}`} />;
}

function Band() {
  return (
    <Section as="div" className="border-edge border-b" clearNav tone="deep">
      <Block className="h-4 w-40 opacity-40" />
      <Block className="mt-5 h-11 w-72 max-w-full opacity-40" />
      <Block className="mt-5 h-4 w-full max-w-(--measure) opacity-40" />
    </Section>
  );
}

const CARDS = [0, 1, 2, 3, 4, 5];
const ROWS = [0, 1, 2, 3, 4];

export function FeedSkeleton() {
  return (
    <>
      <Band />
      <Section tone="paper">
        <div className="mb-8 flex flex-wrap gap-2">
          <Block className="h-8 w-20" />
          <Block className="h-8 w-24" />
          <Block className="h-8 w-16" />
        </div>
        <CardGrid as="div" className="gap-x-6 gap-y-10">
          {CARDS.map((card) => (
            <div key={card}>
              <Block className="aspect-16/9 w-full" />
              <Block className="mt-4 h-5 w-24" />
              <Block className="mt-3 h-6 w-3/4" />
              <Block className="mt-2 h-4 w-1/2" />
            </div>
          ))}
        </CardGrid>
      </Section>
    </>
  );
}

/**
 * Rows only — no band, no `<Section>`.
 *
 * `FeedSkeleton` brings its own band and section, so using it as the fallback
 * of a `<Suspense>` that already sits inside one renders a second header band
 * below the real one. This is the shape for a list that streams inside a page
 * whose header has already been flushed.
 */
export function ListSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {ROWS.map((row) => (
        <div className="rounded-biso-md border border-edge p-6" key={row}>
          <Block className="h-6 w-2/3" />
          <Block className="mt-3 h-4 w-1/3" />
          <Block className="mt-5 h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <>
      <Band />
      <Section tone="paper">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-6 lg:order-1">
            <Block className="aspect-21/9 w-full" />
            <Block className="h-7 w-56" />
            {ROWS.map((row) => (
              <Block className="h-4 w-full" key={row} />
            ))}
          </div>
          <div className="lg:order-2">
            <Block className="h-80 w-full" />
          </div>
        </div>
      </Section>
    </>
  );
}
