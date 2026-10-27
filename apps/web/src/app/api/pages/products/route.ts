import { shopLimitFromParam } from "@repo/editor/page-feeds";
import { cachedPageProductsFeed } from "@/lib/data/public-content";
import {
  feedFailure,
  feedLocale,
  feedResponse,
  requireDepartment,
} from "../_lib/feed";

/**
 * A department's listed shop products for the page-builder's `productGrid`
 * block. Answers a bare array; a failed feed is empty, never an error status.
 * The limit is clamped to 4 or 8 before it reaches the cached reader, so a
 * crafted `?limit=` cannot mint cache entries.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const department = requireDepartment(searchParams);
  if (!department) {
    return feedResponse([]);
  }
  try {
    return feedResponse(
      await cachedPageProductsFeed(
        department,
        feedLocale(searchParams),
        shopLimitFromParam(searchParams.get("limit"))
      )
    );
  } catch {
    return feedFailure();
  }
}
