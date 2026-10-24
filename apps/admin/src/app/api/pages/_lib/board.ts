import { Query } from "@repo/api";
import type { Departments } from "@repo/api/types/appwrite";
import {
  type BoardFeedMember,
  boardFeedMembers,
} from "@repo/editor/page-feeds";
import { isPublicUnit } from "@repo/shared/utils/unit-visibility";
import { feedClient } from "./feed";

const TRAILING_SLASH = /\/+$/;
const BOARD_FETCH_TIMEOUT_MS = 15_000;

/**
 * A department's board, read from `apps/api` (which holds the Azure
 * credentials). The campus comes from the department row, read with the guest
 * client like the other feeds; the id is validated, so the row is looked up by
 * `$id` only.
 *
 * An unknown department is an empty board; any failure THROWS.
 */
export async function readBoardFeed(
  departmentId: string
): Promise<BoardFeedMember[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  const db = await feedClient();
  const { rows } = await db.listRows<Departments>("app", "departments", [
    Query.equal("$id", departmentId),
    Query.select(["$id", "Name", "campus_id", "active", "type"]),
    Query.limit(1),
  ]);
  const department = rows[0];
  // The guest client and the public-unit rule, so the preview shows what the
  // site will.
  if (!(department?.campus_id && isPublicUnit(department))) {
    return [];
  }
  const campusId = department.campus_id;

  const response = await fetch(
    `${baseUrl.replace(TRAILING_SLASH, "")}/api/campus/${encodeURIComponent(campusId)}/${encodeURIComponent(departmentId)}/board`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(BOARD_FETCH_TIMEOUT_MS),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Board lookup failed for ${departmentId}: ${response.status}`
    );
  }
  const payload: unknown = await response.json();
  const members = (payload as { members?: unknown } | null)?.members;
  if (!Array.isArray(members)) {
    throw new Error(`Board response for ${departmentId} had no members`);
  }
  return boardFeedMembers(members);
}
