import { readPageDepartmentsFeed } from "@repo/shared/utils/page-feeds";
import { feedClient, feedResponse, requireFeedAuth } from "../_lib/feed";

/**
 * Active departments for the page editor's auto-source `departmentGrid` block.
 *
 * Answers an object rather than a bare array to match `apps/web`: the block
 * reads `departments` off the payload, and the two hosts must not diverge.
 */
export async function GET(request: Request) {
  const unauthorized = await requireFeedAuth();
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(request.url);

  try {
    const departments = await readPageDepartmentsFeed(
      await feedClient(),
      searchParams.get("campus_id"),
      searchParams.get("type")
    );
    return feedResponse({ departments, total: departments.length });
  } catch {
    return feedResponse({ departments: [], total: 0 });
  }
}
