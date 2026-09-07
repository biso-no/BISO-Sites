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
  locale = ""
): string {
  return `${kind}|${department}|${locale}`;
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
    // No department means the block falls back to its authored placeholder
    // items, which is a documented feature — there is nothing to fetch.
    if (!department) {
      return null;
    }
    return {
      department,
      key: pageFeedKey(block.type, department, locale),
      kind: block.type,
      locale,
    };
  }

  return null;
}

/**
 * Every feed a page needs, deduplicated by `(kind, department, locale)`.
 *
 * Two events blocks pinned to the same department produce one request, so a
 * page cannot multiply its backend round-trips by repeating a block.
 */
export function collectPageFeedRequests(
  doc: PageDoc,
  locale: EditorLocale
): PageFeedRequest[] {
  const byKey = new Map<string, PageFeedRequest>();

  for (const block of doc.blocks) {
    const request = requestForBlock(block, doc.meta.department, locale);
    if (request && !byKey.has(request.key)) {
      byKey.set(request.key, request);
    }
  }

  return [...byKey.values()];
}
