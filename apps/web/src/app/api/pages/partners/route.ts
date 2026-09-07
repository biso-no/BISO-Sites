import { connection } from "next/server";
import { cachedPagePartnersFeed } from "@/lib/data/public-content";
import { feedFailure, feedResponse } from "../_lib/feed";

/**
 * National partners for the page-builder's auto-source `partners` block.
 *
 * Unlike the other feeds this one takes no department — the block renders the
 * national partner set. See `../_lib/feed` for why failures answer 200.
 */
export async function GET() {
  // Render per request, not at build time. This is the only one of the five
  // feed routes with no search params to read, so Next prerendered it as
  // static and `next build` grew a hard dependency on Appwrite being
  // reachable — it surfaced as `fetch failed` during static generation.
  // `connection()` is the cacheComponents-compatible way to say "wait for a
  // request"; the `dynamic` segment config is rejected outright under it.
  // Caching still happens, in the `"use cache"` reader behind this route.
  await connection();
  try {
    return feedResponse(await cachedPagePartnersFeed());
  } catch {
    return feedFailure();
  }
}
