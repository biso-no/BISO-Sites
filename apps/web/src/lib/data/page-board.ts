import { BOARD_FEED_LIMIT } from "@repo/editor/page-feeds";
import { cachedDepartmentById } from "./public-content";
import { cachedUnitBoard } from "./unit-board";

/** One board member as the page editor's team block reads it. */
export interface BoardFeedMember {
  email?: string;
  name: string;
  phone?: string;
  photo?: { src: string };
  role: string;
}

/**
 * A department's elected board for the page editor's team block.
 *
 * An unknown or non-public department is an empty board, which is a stable
 * answer. An API or Graph failure THROWS, so callers can drop the feed instead
 * of recording an outage as an empty team.
 */
export async function readBoardFeed(
  departmentId: string
): Promise<BoardFeedMember[]> {
  const department = await cachedDepartmentById(departmentId);
  if (!department?.campus_id) {
    return [];
  }
  const board = await cachedUnitBoard(department.campus_id, departmentId);
  return board.slice(0, BOARD_FEED_LIMIT).map((member) => ({
    ...(member.email ? { email: member.email } : {}),
    name: member.name,
    ...(member.phone ? { phone: member.phone } : {}),
    ...(member.imageUrl ? { photo: { src: member.imageUrl } } : {}),
    role: member.role ?? "",
  }));
}
