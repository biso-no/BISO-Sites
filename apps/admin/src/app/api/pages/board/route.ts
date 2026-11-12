import { readBoardFeed } from "../_lib/board";
import { departmentFeedRoute } from "../_lib/feed";

/**
 * A department's board, for the page editor's `team` block with the board
 * source. Editors only; a failure is an empty feed, like the other feeds.
 */
export const GET = departmentFeedRoute((department) =>
  readBoardFeed(department)
);
