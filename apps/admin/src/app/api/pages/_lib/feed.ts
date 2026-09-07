import { createPublicClient } from "@repo/api/server";
import type { PageFeedLocale } from "@repo/shared/utils/page-feeds";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";

/**
 * The page-builder's auto-source feeds, for the editor canvas.
 *
 * `@repo/editor`'s events/news/jobs/partners/departmentGrid blocks fetch
 * `/api/pages/*` with a RELATIVE url. Only `apps/web` ever implemented those
 * routes, so in the canvas on :3001 all five hit a 404, `r.json()` threw, and
 * every block silently fell back to its placeholder items — the editor preview
 * has never shown live feed data. These routes close that gap; the alternative,
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
 * Blocks call `r.json()` and swallow failures into placeholder items, so an
 * error status would put demo content in the canvas with no visible reason.
 * Answer 200 with an empty payload instead, and keep it uncacheable.
 */
export function feedResponse(payload: unknown) {
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}

/** Department id the feed is scoped to; blank means "nothing to show". */
export function requireDepartment(params: URLSearchParams): string | null {
  const dept = params.get("dept")?.trim();
  return dept ? dept : null;
}

export function feedLocale(params: URLSearchParams): PageFeedLocale {
  return params.get("locale") === "en" ? "en" : "no";
}
