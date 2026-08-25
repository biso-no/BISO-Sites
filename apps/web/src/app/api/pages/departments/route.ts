import { cachedPageDepartmentsFeed } from "@/lib/data/public-content";
import { feedFailure, feedResponse } from "../_lib/feed";

/**
 * Active departments for the page-builder's auto-source `departmentGrid` block.
 *
 * Unlike the other feeds this one answers an object, not a bare array — the
 * block reads `departments` off the payload, and changing that shape would
 * break editors running an older bundle.
 *
 * It used to read through `createAdminClient()` with no cached reader behind
 * it; it now goes through `cachedPageDepartmentsFeed` on the guest client like
 * every other feed. See that reader for why the service key was unnecessary.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campusId = searchParams.get("campus_id");
  const type = searchParams.get("type");

  try {
    // Passed through unchanged. `total` is Appwrite's count of every matching
    // row and is independent of how many this page returned, so it stays
    // meaningful if the reader's limit is ever exceeded again.
    return feedResponse(await cachedPageDepartmentsFeed(campusId, type));
  } catch {
    return feedFailure({ departments: [], total: 0 });
  }
}
