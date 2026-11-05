import { shopLimitFromParam } from "@repo/editor/page-feeds";
import { cachedPageProductsFeed } from "@/lib/data/public-content";
import { departmentFeedRoute, feedLocale } from "../_lib/feed";

/**
 * A department's listed shop products for the page-builder's `productGrid`
 * block. Answers a bare array; a failed feed is empty, never an error status.
 * The limit is clamped to 4 or 8 before it reaches the cached reader, so a
 * crafted `?limit=` cannot mint cache entries.
 */
export const GET = departmentFeedRoute((department, params) =>
  cachedPageProductsFeed(
    department,
    feedLocale(params),
    shopLimitFromParam(params.get("limit"))
  )
);
