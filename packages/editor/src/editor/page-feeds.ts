/**
 * Feed identity for the auto-source blocks.
 *
 * Seven blocks (events/news/jobs/partners/departmentGrid/productGrid/team) render content that
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
  | "board"
  | "departments"
  | "events"
  | "jobs"
  | "news"
  | "partners"
  | "products";

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
  /** Campus id a departments feed is narrowed to; empty for all campuses. */
  campus?: string;
  /** Unit category a departments feed is narrowed to; empty for all. */
  category?: string;
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

/**
 * A limit narrowed to the values a block can ask for. It becomes part of a
 * cache key, so anything else (999, "abc", "6", missing) must collapse to the
 * allowed set instead of minting new entries. Strings are parsed, because the
 * same function clamps a `?limit=` query parameter.
 */
export function clampFeedLimit<T extends number>(
  raw: unknown,
  allowed: readonly T[],
  fallback: NoInfer<T>
): T {
  const value = typeof raw === "string" ? Number(raw) : raw;
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

const FEED_LIMITS = [3, 6] as const;
const SHOP_LIMITS = [4, 8] as const;
const UNIT_LIMITS = [3, 6, 9, 12] as const;

/**
 * The `?limit=` of a feed request, narrowed to the values a block can ask for.
 */
export function feedLimitFromParam(raw: string | null | undefined): 3 | 6 {
  return feedBlockLimit(raw);
}

/** How many rows a live block shows: 3 or 6, whatever the stored value is. */
export function feedBlockLimit(value: unknown): 3 | 6 {
  return clampFeedLimit(value, FEED_LIMITS, 3);
}

/** How many products the shop block shows: 4 or 8. */
export function shopBlockLimit(value: unknown): 4 | 8 {
  return clampFeedLimit(value, SHOP_LIMITS, 4);
}

/** The shop feed's `?limit=`, narrowed like `shopBlockLimit`. */
export function shopLimitFromParam(raw: string | null | undefined): 4 | 8 {
  return shopBlockLimit(raw);
}

/** How many unit cards the units block shows. */
export function unitsBlockLimit(value: unknown): 3 | 6 | 9 | 12 {
  return clampFeedLimit(value, UNIT_LIMITS, 6);
}

/**
 * The campus a units block is narrowed to: the page's own for scope `campus`,
 * none otherwise. A national page has no campus, so `campus` scope there shows
 * every unit rather than nothing.
 */
export function unitsFeedCampus(scope: unknown, pageCampus: unknown): string {
  return unitsScope(scope) === "campus" && typeof pageCampus === "string"
    ? pageCampus
    : "";
}

/** A units block's scope; missing or unknown is the `emptyBlock` default. */
export function unitsScope(value: unknown): "campus" | "all" {
  return value === "all" ? "all" : "campus";
}

/** A team block's source; missing or unknown is the `emptyBlock` default. */
export function teamSource(value: unknown): "manual" | "board" {
  return value === "board" ? "board" : "manual";
}

/** The most members a board feed carries; both hosts cap at this. */
export const BOARD_FEED_LIMIT = 24;

/** One board member as the team block reads it. There is no phone: see below. */
export interface BoardFeedMember {
  email?: string;
  name: string;
  photo?: { src: string };
  role: string;
}

const boardText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

/**
 * A raw board entry (the unit board reader's or `apps/api`'s shape) as a feed
 * item, or null without a name.
 *
 * Phone numbers are dropped on purpose. The coded unit page shows board emails
 * only, and a feed snapshot ships to the browser whatever `showContact` says,
 * so a number kept here would be published.
 */
export function toBoardFeedMember(entry: unknown): BoardFeedMember | null {
  if (typeof entry !== "object" || entry === null) {
    return null;
  }
  const row = entry as Record<string, unknown>;
  const name = boardText(row.name);
  if (!name) {
    return null;
  }
  const email = boardText(row.email);
  const photo = boardText(row.imageUrl) ?? boardText(row.profilePhotoUrl);
  return {
    ...(email ? { email } : {}),
    name,
    ...(photo ? { photo: { src: photo } } : {}),
    role: boardText(row.role) ?? "",
  };
}

/** Raw board entries as feed items, capped at `BOARD_FEED_LIMIT`. */
export function boardFeedMembers(entries: unknown[]): BoardFeedMember[] {
  return entries
    .map(toBoardFeedMember)
    .filter((member): member is BoardFeedMember => member !== null)
    .slice(0, BOARD_FEED_LIMIT);
}

/** A partners block's source; missing or unknown is the `emptyBlock` default. */
export function partnersSource(value: unknown): "auto" | "manual" {
  return value === "manual" ? "manual" : "auto";
}

/**
 * Unit categories a units block can filter by. A copy of
 * `UNIT_CATEGORIES` in `@repo/shared` (this package does not depend on it);
 * `apps/web/src/lib/data/unit-category-ids.test.ts` keeps the two equal.
 */
export const UNIT_CATEGORY_IDS = [
  "society",
  "academic_association",
  "project",
  "staff_function",
  "national",
  "other",
] as const;

/** The block's category if it is a known one, else "" (all categories). */
export function unitsFeedCategory(raw: unknown): string {
  return typeof raw === "string" &&
    (UNIT_CATEGORY_IDS as readonly string[]).includes(raw)
    ? raw
    : "";
}

/** The units feed's identity: it is scoped by campus and category only. */
export function departmentsFeedKey(campus = "", category = ""): string {
  return pageFeedKey("departments", campus, category);
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

export function requestForBlock(
  block: Block,
  pageDepartment: string,
  pageCampus: string,
  locale: EditorLocale
): PageFeedRequest | null {
  if (block.type === "departmentGrid") {
    const campus = unitsFeedCampus(block.scope, pageCampus);
    const category = unitsFeedCategory(block.category);
    return {
      campus,
      category,
      department: "",
      key: departmentsFeedKey(campus, category),
      kind: "departments",
      locale,
    };
  }

  if (block.type === "productGrid") {
    const department = resolveFeedDepartment(block.source, pageDepartment);
    if (!department) {
      return null;
    }
    const limit = shopBlockLimit(block.limit);
    return {
      department,
      key: pageFeedKey("products", department, locale, limit),
      kind: "products",
      limit,
      locale,
    };
  }

  if (block.type === "team") {
    // A manual team block renders the people the author typed in. A board one
    // reads the page's own department, so a page with none has nothing to show.
    if (teamSource(block.source) !== "board" || !pageDepartment) {
      return null;
    }
    return {
      department: pageDepartment,
      key: pageFeedKey("board", pageDepartment),
      kind: "board",
      locale,
    };
  }

  if (block.type === "partners") {
    // A manual partners block renders the logos the author picked; there is
    // no feed behind it.
    return partnersSource(block.source) === "auto"
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
    const request = requestForBlock(
      block,
      doc.meta.department,
      doc.meta.campus ?? "",
      locale
    );
    if (request && !byKey.has(request.key)) {
      byKey.set(request.key, request);
    }
  }

  return [...byKey.values()];
}
