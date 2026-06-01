import { STUDIO } from "./(portal)/_components/studio";

/**
 * Root-level loading state shown while the initial page shell suspends.
 * Intentionally minimal — the portal shell has its own skeleton states.
 */
export default function RootLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: STUDIO.paper }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Animated crest */}
        <div
          className="h-10 w-10 animate-pulse rounded-lg"
          style={{ background: STUDIO.rule2 }}
        />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full"
              key={i}
              style={{
                animationDelay: `${i * 120}ms`,
                background: STUDIO.ink4,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
