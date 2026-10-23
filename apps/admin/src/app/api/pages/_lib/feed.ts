import { createPublicClient } from "@repo/api/server";
import type { PageFeedLocale } from "@repo/shared/utils/page-feeds";
import { feedDepartmentId } from "@repo/shared/utils/page-feeds";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";

/**
 * The page-builder's auto-source feeds, for the editor canvas.
 *
 * `@repo/editor`'s events/news/jobs/partners/departmentGrid blocks fetch
 * `/api/pages/*` with a RELATIVE url. Only `apps/web` ever implemented those
 * routes, so in the canvas on :3001 all five hit a 404, `r.json()` threw, and
 * every block silently came up empty — the editor preview has never shown live
 * feed data. These routes close that gap; the alternative,
 * pointing the blocks at an absolute web URL, would make the CMS depend on the
 * public site being reachable and need CORS on top.
 *
 * Deliberately the GUEST client, not the caller's session: the canvas is a
 * preview of a page that anonymous visitors will read, so it must show exactly
 * the rows they will get. A session client would additionally surface rows the
 * editor can see and the public cannot, which is a misleading preview.
 *
 * Also deliberately uncached, unlike `apps/web`'s `"use cache"` readers. There
 * the concern is thousands of anonymous visitors fanning out into the Appwrite
 * worker pool; here it is a handful of signed-in editors who need the feed to
 * follow the department they just picked.
 */
export async function feedClient() {
  return (await createPublicClient()).db;
}

/** Editors only — this app gates every route segment itself, there is no middleware. */
export async function requireFeedAuth(): Promise<NextResponse | null> {
  const auth = await requireApiAuth();
  return auth.response ?? null;
}

/**
 * Blocks call `r.json()` and swallow failures into an empty feed, so an
 * error status would leave the canvas blank with no visible reason.
 * Answer 200 with an empty payload instead, and keep it uncacheable.
 */
export function feedResponse(payload: unknown) {
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Department id the feed is scoped to; blank or malformed means "nothing to
 * show". Validated here because it becomes part of a cache key.
 */
export function requireDepartment(params: URLSearchParams): string | null {
  return feedDepartmentId(params.get("dept"));
}

export function feedLocale(params: URLSearchParams): PageFeedLocale {
  return params.get("locale") === "en" ? "en" : "no";
}
