import { Section } from "@/components/ui/section";

/**
 * What `/member` looks like before it streams in: the navy header band, the
 * tab bar, and a row of cards — the shape of the page that follows, so
 * nothing reflows when it arrives.
 *
 * Still blocks rather than `animate-pulse`, as in `ui/loading-shell`: a pulse
 * runs regardless of `prefers-reduced-motion`.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-biso-sm bg-surface-sunken ${className}`} />;
}

const TABS = [0, 1, 2, 3, 4, 5];
const CARDS = [0, 1, 2];

export function MemberPortalSkeleton() {
  return (
    <>
      <Section as="div" className="border-edge border-b" clearNav tone="deep">
        <Block className="h-4 w-40 opacity-40" />
        <Block className="mt-5 h-11 w-80 max-w-full opacity-40" />
        <div className="mt-5 flex gap-2">
          <Block className="h-7 w-24 opacity-40" />
          <Block className="h-7 w-40 opacity-40" />
        </div>
      </Section>
      <Section tone="paper">
        <div className="mb-8 flex gap-1 overflow-hidden rounded-biso-md border border-edge p-1">
          {TABS.map((tab) => (
            <Block className="h-9 w-28 shrink-0" key={tab} />
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {CARDS.map((card) => (
            <div className="rounded-biso-md border border-edge p-6" key={card}>
              <Block className="h-4 w-24" />
              <Block className="mt-3 h-8 w-32" />
              <Block className="mt-3 h-4 w-20" />
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
