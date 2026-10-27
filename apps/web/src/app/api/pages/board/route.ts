import { readBoardFeed } from "@/lib/data/page-board";
import { feedFailure, feedResponse, requireDepartment } from "../_lib/feed";

/**
 * A department's board for the page-builder's `team` block. Answers a bare
 * array; a failed feed is empty and uncacheable, never an error status.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const department = requireDepartment(searchParams);
  if (!department) {
    return feedResponse([]);
  }
  try {
    return feedResponse(await readBoardFeed(department));
  } catch {
    return feedFailure();
  }
}
