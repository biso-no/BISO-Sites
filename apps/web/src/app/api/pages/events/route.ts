import { feedLimitFromParam } from "@repo/editor/page-feeds";
import { cachedPageEventsFeed } from "@/lib/data/public-content";
import {
  feedFailure,
  feedLocale,
  feedResponse,
  requireDepartment,
} from "../_lib/feed";

/**
 * Upcoming events for a department for the page-builder's auto-source `events` block.
 *
 * Consumed by `packages/editor/src/blocks/events/render.tsx`, which expects a
 * bare JSON array. A failed feed renders as empty, never as an error, so this
 * route must answer 200 with `[]` rather than throw.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const department = requireDepartment(searchParams);
  if (!department) {
    return feedResponse([]);
  }
  try {
    return feedResponse(
      await cachedPageEventsFeed(
        department,
        feedLocale(searchParams),
        feedLimitFromParam(searchParams.get("limit"))
      )
    );
  } catch {
    return feedFailure();
  }
}
