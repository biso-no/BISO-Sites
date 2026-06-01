import { STUDIO } from "./_components/studio";

/**
 * Segment-level loading state for the portal. Rendered inside the AdminShell
 * (the layout stays mounted), so navigating between portal routes shows a
 * content skeleton immediately instead of blocking on the route's data
 * fetches with a blank screen.
 */
export default function PortalLoading() {
  return (
    <output aria-busy="true" aria-label="Loading" className="block pb-12">
      {/* Header skeleton */}
      <div className="mb-8 space-y-3">
        <div
          className="h-7 w-56 animate-pulse rounded-md"
          style={{ background: STUDIO.rule2 }}
        />
        <div
          className="h-4 w-80 animate-pulse rounded-md"
          style={{ background: STUDIO.rule }}
        />
      </div>

      {/* Content rows skeleton */}
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            className="h-16 animate-pulse rounded-2xl border"
            key={i}
            style={{
              background: "rgba(255,255,255,0.46)",
              borderColor: STUDIO.rule,
            }}
          />
        ))}
      </div>
    </output>
  );
}
