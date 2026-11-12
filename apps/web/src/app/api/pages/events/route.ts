import { feedLimitFromParam } from "@repo/editor/page-feeds";
import { cachedPageEventsFeed } from "@/lib/data/public-content";
import { departmentFeedRoute, feedLocale } from "../_lib/feed";

/**
 * Upcoming events for a department for the page-builder's auto-source `events` block.
 *
 * Consumed by `packages/editor/src/blocks/events/render.tsx`, which expects a
 * bare JSON array. A failed feed renders as empty, never as an error, so this
 * route must answer 200 with `[]` rather than throw.
 */
export const GET = departmentFeedRoute((department, params) =>
  cachedPageEventsFeed(
    department,
    feedLocale(params),
    feedLimitFromParam(params.get("limit"))
  )
);
