import { readBoardFeed } from "@/lib/data/page-board";
import { departmentFeedRoute } from "../_lib/feed";

/**
 * A department's board for the page-builder's `team` block. Answers a bare
 * array; a failed feed is empty and uncacheable, never an error status.
 */
export const GET = departmentFeedRoute((department) =>
  readBoardFeed(department)
);
