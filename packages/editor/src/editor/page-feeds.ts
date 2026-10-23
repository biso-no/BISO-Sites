/**
 * Feed identity for the auto-source blocks.
 *
 * Five blocks (events/news/jobs/partners/departmentGrid) render content that
 * lives in Appwrite rather than in the page document. A rendering host can
 * resolve those feeds up front and hand them to the blocks, which is how the
 * public site gets real rows into its server-rendered HTML instead of a
 * "Loading…" placeholder.
 *
 * That only works if the host and the block agree, exactly, on which feed a
 * given block wants — a disagreement means the block ignores what the server
 * fetched, renders "Loading…" on both passes, and the whole exercise is
 * silently a no-op. So the key derivation lives here, in one pure module with
 * no React and no data access, and both sides import it.
 */

import { walkBlocks } from "./tree";
import type { Block, EditorLocale, PageDoc } from "./types";

/** The backend feeds an auto-source block can pull from. */
export type PageFeedKind =
  | "departments"
  | "events"
  | "jobs"
  | "news"
  | "partners";

/**
 * Feeds a host has already resolved, keyed by `pageFeedKey`.
 *
 * Values are `unknown[]` on purpose: each block owns the shape of its own
 * items, and this map has to survive JSON serialization across the
 * Server→Client boundary. Blocks cast on read.
 */
export type PageFeedSnapshot = Record<string, unknown[]>;

/** One feed a page needs, ready to be resolved by a host. */
export interface PageFeedRequest {
  /** Department id to scope by; empty for feeds that are not scoped. */
  department: string;
  key: string;
  kind: PageFeedKind;
  /** How many rows the block shows; set for events, news and jobs only. */
  limit?: number;
  locale: EditorLocale;
}

/**
 * Stable identity for one resolved feed.
 *
 * `partners` and `departments` are neither department- nor locale-scoped, so
 * they pass the empty defaults and collapse to a single key per page.
 */
export function pageFeedKey(
  kind: PageFeedKind,
  department = "",
  locale = "",
  limit?: number
): string {
  const base = `${kind}|${department}|${locale}`;
  // Two blocks that want different row counts need different fetches, so the
  // count is part of the identity. Unlimited feeds keep the three-part key.
  return limit ? `${base}|${limit}` : base;
}

/** How many rows a live block shows: 3 or 6, whatever the stored value is. */
export function feedBlockLimit(value: unknown): 3 | 6 {
  return value === 6 ? 6 : 3;
}

/**
 * The department an auto-source block reads from.
 *
 * `"auto"` (and a missing value, which older documents use) follows the page's
 * own department; anything else is an explicit department id the author pinned
 * on the block.
 */
export function resolveFeedDepartment(
  source: string | undefined,
  pageDepartment: string
): string {
  const value = source || "auto";
  return value === "auto" ? pageDepartment : value;
}

function requestForBlock(
  block: Block,
  pageDepartment: string,
  locale: EditorLocale
): PageFeedRequest | null {
  if (block.type === "departmentGrid") {
    return {
      department: "",
      key: pageFeedKey("departments"),
      kind: "departments",
      locale,
    };
  }

  if (block.type === "partners") {
    // A manual partners block renders the logos the author picked; there is
    // no feed behind it.
    return block.source === "auto"
      ? {
          department: "",
          key: pageFeedKey("partners"),
          kind: "partners",
          locale,
        }
      : null;
  }

  if (
    block.type === "events" ||
    block.type === "jobs" ||
    block.type === "news"
  ) {
    const department = resolveFeedDepartment(block.source, pageDepartment);
    // No department means the block renders nothing on the site, so there is
    // nothing to fetch.
    if (!department) {
      return null;
    }
    const limit = feedBlockLimit(block.limit);
    return {
      department,
      key: pageFeedKey(block.type, department, locale, limit),
      kind: block.type,
      limit,
      locale,
    };
  }

  return null;
}

/**
 * Every feed a page needs, deduplicated by `(kind, department, locale, limit)`.
 *
 * Two events blocks pinned to the same department and row count produce one request, so a
 * page cannot multiply its backend round-trips by repeating a block.
 */
export function collectPageFeedRequests(
  doc: PageDoc,
  locale: EditorLocale
): PageFeedRequest[] {
  const byKey = new Map<string, PageFeedRequest>();

  for (const block of walkBlocks(doc)) {
    const request = requestForBlock(block, doc.meta.department, locale);
    if (request && !byKey.has(request.key)) {
      byKey.set(request.key, request);
    }
  }

  return [...byKey.values()];
}
