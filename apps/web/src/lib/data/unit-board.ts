/**
 * A unit's board, read from Microsoft 365.
 *
 * BISO keeps no board roster of its own: `department_board` and
 * `department_socials` are both empty, and nothing writes to them. The living
 * roster is Entra ID, where every elected student carries
 * `department = "<the unit's 24SO name>"` and `officeLocation = "<campus>"`.
 * 117 of the 125 public units resolve a board this way today.
 *
 * The Graph query itself already exists as `apps/api`'s
 * `/api/campus/{campusId}/{department}/board` — the same endpoint the campus
 * Team tab calls — so this is a thin cached wrapper rather than a second Graph
 * integration. Keep it that way: `AZURE_*` credentials live in `apps/api`, and
 * `apps/web` must not grow its own copy.
 *
 * UNLIKE `/campus`, this runs on the SERVER behind `"use cache"`:
 *  - a unit page is one of ~125 crawlable pages whose main content is the
 *    board, so it has to be in the first HTML, not fetched after hydration;
 *  - one Graph round-trip then serves every visitor instead of one per view.
 *
 * Photos come back as `data:` URIs. That is deliberate — Graph's photo
 * endpoint needs an access token, and `next.config.ts#images.remotePatterns`
 * does not (and should not) allow `graph.microsoft.com`.
 */

import { cacheLife } from "next/cache";

/** Graph returns whole units; a board of >60 is a data error, not a board. */
const MAX_BOARD_MEMBERS = 60;

const BOARD_FETCH_TIMEOUT_MS = 15_000;

export interface UnitBoardMember {
  email: string | null;
  imageUrl: string | null;
  name: string;
  role: string | null;
}

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

function toBoardMember(entry: Record<string, unknown>): UnitBoardMember | null {
  const name = asString(entry.name) ?? asString(entry.displayName);
  if (!name) {
    return null;
  }
  return {
    email: asString(entry.email) ?? asString(entry.mail),
    imageUrl: asString(entry.profilePhotoUrl) ?? asString(entry.imageUrl),
    name,
    role: asString(entry.role) ?? asString(entry.jobTitle),
  };
}

/**
 * The board of one unit.
 *
 * Takes the department's `$id`, not its name: the API route resolves a numeric
 * segment against the `departments` table itself, so the campus-prefixed
 * accounting name never has to be reconstructed or URL-encoded here.
 *
 * THROWS on any failure — a dead API, a Graph outage, a timeout, a malformed
 * payload — and callers must supply their own fallback with `.catch()`. This
 * is not defensive fussiness: `"use cache"` does not cache a rejected promise
 * but it very much caches a resolved `[]`, so swallowing an outage here would
 * pin an empty board onto ~125 unit pages for the whole `cacheLife("hours")`
 * window, long after the API came back. Only a genuinely empty directory
 * result — the eight-or-so units with no matching entries — resolves to `[]`
 * and is cached, which is exactly right: that answer is stable and re-asking
 * Graph on every view would buy nothing.
 */
export async function cachedUnitBoard(
  campusId: string,
  departmentId: string
): Promise<UnitBoardMember[]> {
  "use cache";
  cacheLife("hours");

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  const response = await fetch(
    `${baseUrl}/api/campus/${encodeURIComponent(campusId)}/${encodeURIComponent(departmentId)}/board`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(BOARD_FETCH_TIMEOUT_MS),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Unit board lookup failed for department ${departmentId}: ${response.status}`
    );
  }

  const payload: unknown = await response.json();
  const members = (payload as { members?: unknown })?.members;
  if (!Array.isArray(members)) {
    throw new Error(
      `Unit board response for department ${departmentId} carried no members array`
    );
  }

  return members
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null
    )
    .map(toBoardMember)
    .filter((member): member is UnitBoardMember => member !== null)
    .slice(0, MAX_BOARD_MEMBERS);
}
