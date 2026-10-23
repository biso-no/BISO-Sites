import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";
import { BOARD_FEED_LIMIT } from "@repo/editor/page-feeds";

const TRAILING_SLASH = /\/+$/;
const BOARD_FETCH_TIMEOUT_MS = 15_000;

/** One board member as the page editor's team block reads it. */
export interface BoardFeedMember {
  email?: string;
  name: string;
  phone?: string;
  photo?: { src: string };
  role: string;
}

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

function toMember(entry: unknown): BoardFeedMember | null {
  if (typeof entry !== "object" || entry === null) {
    return null;
  }
  const row = entry as Record<string, unknown>;
  const name = asString(row.name);
  if (!name) {
    return null;
  }
  const email = asString(row.email);
  const phone = asString(row.phone);
  const photo = asString(row.profilePhotoUrl);
  return {
    ...(email ? { email } : {}),
    name,
    ...(phone ? { phone } : {}),
    ...(photo ? { photo: { src: photo } } : {}),
    role: asString(row.role) ?? "",
  };
}

/**
 * A department's board, read from `apps/api` (which holds the Azure
 * credentials). The campus comes from the department row, read with the admin
 * client: the caller has already been authorised by the route, and the id is
 * validated, so the row is looked up by `$id` only.
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

  const { db } = await createAdminClient();
  const { rows } = await db.listRows<Departments>("app", "departments", [
    Query.equal("$id", departmentId),
    Query.select(["$id", "campus_id"]),
    Query.limit(1),
  ]);
  const campusId = rows[0]?.campus_id;
  if (!campusId) {
    return [];
  }

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
  return members
    .map(toMember)
    .filter((member): member is BoardFeedMember => member !== null)
    .slice(0, BOARD_FEED_LIMIT);
}
