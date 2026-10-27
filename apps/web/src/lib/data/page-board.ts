import {
  type BoardFeedMember,
  boardFeedMembers,
} from "@repo/editor/page-feeds";
import { cachedDepartmentById } from "./public-content";
import { cachedUnitBoard } from "./unit-board";

/**
 * A department's elected board for the page editor's team block.
 *
 * An unknown or non-public department is an empty board, which is a stable
 * answer. An API or Graph failure THROWS, so callers can drop the feed instead
 * of recording an outage as an empty team. Phone numbers never leave here.
 */
export async function readBoardFeed(
  departmentId: string
): Promise<BoardFeedMember[]> {
  const department = await cachedDepartmentById(departmentId);
  if (!department?.campus_id) {
    return [];
  }
  return boardFeedMembers(
    await cachedUnitBoard(department.campus_id, departmentId)
  );
}
