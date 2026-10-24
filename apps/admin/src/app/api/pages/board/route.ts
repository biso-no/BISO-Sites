import { readBoardFeed } from "../_lib/board";
import { feedResponse, requireDepartment, requireFeedAuth } from "../_lib/feed";

/**
 * A department's board, for the page editor's `team` block with the board
 * source. Editors only; a failure is an empty feed, like the other feeds.
 */
export async function GET(request: Request) {
  const unauthorized = await requireFeedAuth();
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(request.url);
  const department = requireDepartment(searchParams);
  if (!department) {
    return feedResponse([]);
  }

  try {
    return feedResponse(await readBoardFeed(department));
  } catch {
    return feedResponse([]);
  }
}
