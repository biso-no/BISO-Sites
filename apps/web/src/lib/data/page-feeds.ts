/**
 * Server-side resolution of a block page's auto-source feeds.
 *
 * The five auto-source blocks (events/news/jobs/partners/departmentGrid) are
 * Client Components — they have to be, because `BlockRenderer` hands every
 * block an `onPatch` function and the same component serves the admin canvas.
 * Left to themselves they fetch `/api/pages/*` from a `useEffect`, so the HTML
 * a crawler, a link unfurler or a JavaScript-less visitor receives contains
 * "Loading…" and nothing else.
 *
 * So the page resolves the feeds here instead, before it renders, and passes
 * the result down as ordinary serializable props. The blocks seed their state
 * from it and skip the fetch entirely. Nothing about the block/host contract
 * changes, and the editor — which mounts no provider — keeps fetching live.
 *
 * These call the `"use cache"` readers directly rather than the HTTP routes in
 * front of them. Fetching our own route would add a round trip and would put a
 * second cache in the path for no benefit; the readers already guarantee one
 * Appwrite round-trip per revalidation window, which is the rule this whole
 * data module exists to keep.
 */

import type {
  PageFeedRequest,
  PageFeedSnapshot,
} from "@repo/editor/page-feeds";
import { collectPageFeedRequests } from "@repo/editor/page-feeds";
import type { PageDoc } from "@repo/editor/types";
import {
  cachedPageDepartmentsFeed,
  cachedPageEventsFeed,
  cachedPageJobsFeed,
  cachedPageNewsFeed,
  cachedPagePartnersFeed,
} from "./public-content";
import type { PublicLocale } from "./queries";

function readFeed(request: PageFeedRequest): Promise<unknown[]> {
  const locale = request.locale as PublicLocale;
  switch (request.kind) {
    case "departments":
      // The snapshot carries rows; the endpoint's `total` is for consumers
      // that page, and the block never reads it.
      return cachedPageDepartmentsFeed().then((feed) => feed.departments);
    case "events":
      return cachedPageEventsFeed(request.department, locale);
    case "jobs":
      return cachedPageJobsFeed(request.department, locale);
    case "news":
      return cachedPageNewsFeed(request.department, locale);
    case "partners":
      return cachedPagePartnersFeed();
    default: {
      // Exhaustive: a new feed kind added in `@repo/editor` fails to compile
      // here rather than silently rendering "Loading…" forever.
      const unreachable: never = request.kind;
      throw new Error(`Unhandled page feed kind: ${String(unreachable)}`);
    }
  }
}

/**
 * Resolve every feed the page needs, keyed by `pageFeedKey`.
 *
 * A feed that fails is left out of the snapshot rather than recorded as empty.
 * The block then falls back to fetching it over HTTP after hydration, which is
 * exactly the old behaviour — a transient Appwrite blip costs the crawler its
 * feed content, not the visitor.
 */
export async function resolvePageFeeds(
  doc: PageDoc,
  locale: PublicLocale
): Promise<PageFeedSnapshot> {
  const requests = collectPageFeedRequests(doc, locale);
  if (requests.length === 0) {
    return {};
  }

  const resolved = await Promise.all(
    requests.map(async (request) => {
      const items = await readFeed(request).catch(() => null);
      return items ? ([request.key, items] as const) : null;
    })
  );

  return Object.fromEntries(resolved.filter((entry) => entry !== null));
}
