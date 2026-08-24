import { NextResponse } from "next/server";
import type { PublicLocale } from "@/lib/data/queries";

/**
 * Shared plumbing for the page-builder's auto-source feeds.
 *
 * Every block in `@repo/editor` fetches these endpoints, calls `r.json()`, and
 * swallows failures into its own placeholder items. A 404 or a 500 therefore
 * shows the editor's demo content ("Event title / Where / 0 going") to the
 * public with no visible error, so these routes always answer 200 with an
 * array — empty when there is genuinely nothing to show.
 */
export function feedResponse<T>(items: T[]) {
  return NextResponse.json(items, {
    headers: {
      // Matches the `cacheLife("minutes")` on the readers behind these routes.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

/**
 * An empty feed caused by a failure, not by an absence of content.
 *
 * Shaped identically so the blocks keep working, but explicitly uncacheable:
 * sharing `feedResponse`'s headers would let one transient Appwrite blip be
 * stored as a successful empty feed and replayed to every visitor for the next
 * five minutes, long after the backend recovered. It would also undo the
 * reader module's deliberate choice not to cache rejected promises.
 */
export function feedFailure() {
  return NextResponse.json([], {
    headers: { "Cache-Control": "no-store" },
  });
}

/** Department id the feed is scoped to; blank means "nothing to show". */
export function requireDepartment(params: URLSearchParams): string | null {
  const dept = params.get("dept")?.trim();
  return dept ? dept : null;
}

export function feedLocale(params: URLSearchParams): PublicLocale {
  return params.get("locale") === "en" ? "en" : "no";
}
