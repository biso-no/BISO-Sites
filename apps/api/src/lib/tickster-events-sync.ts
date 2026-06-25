import { ID, Permission, Query, Role, type TablesDB } from "@repo/api";
// Type-only import: the connectors client pulls in `server-only` and is loaded
// lazily (see `createClient`) so unit tests that inject a fake client never touch
// it.
import type {
  ListTicksterEventsParams,
  TicksterEventDetail,
  TicksterEventListItem,
  TicksterEventsClient,
  TicksterVenue,
} from "@repo/connectors/tickster";

/**
 * Tickster **published-event** → internal `events` sync.
 *
 * Pulls the events BISO has published to tickster.com (via the Event API) and
 * mirrors them into the `events` table + `content_translations` so they appear
 * on the public web app and native app alongside natively-created events. This
 * is SEPARATE from `tickster-sync.ts`, which imports ticket *buyers* (CRM
 * purchases) into `event_attendees`.
 *
 * Design mirrors the Entur departures sync: env-driven config, a secret-gated
 * route, and idempotent upserts keyed on a deterministic row id derived from the
 * Tickster event id (so re-runs update in place rather than duplicating).
 *
 * Per the operator's configuration the default strategy issues one query per
 * campus filtered by Tickster *organizer* name and stamps that campus on every
 * result. Adjust the organizer names / campus mapping via
 * `TICKSTER_EVENTS_QUERY_MAP` to match the real Tickster organizer accounts.
 *
 * Inert until `TICKSTER_API_KEY` is configured.
 */

const DEFAULT_DATABASE_ID = "app";
const DEFAULT_EVENTS_TABLE_ID = "events";
const DEFAULT_TRANSLATIONS_TABLE_ID = "content_translations";
const DEFAULT_TAKE = 50;
/** Tickster's hard cap on the `take` query param. */
const MAX_TAKE = 100;
const DEFAULT_STATUS = "published";
/** Safety bound on per-campus pagination so a misbehaving API can't loop. */
const MAX_PAGES_PER_CAMPUS = 20;
/** Appwrite team that owns/edits content rows (matches the admin event flow). */
const OPERATIONS_TEAM_ID = "sg-app-dept-operationsunit";
/** Tickster id → Appwrite row id prefix, namespacing synced rows away from
 * natively-created events (which use random ids). */
const ROW_ID_PREFIX = "tkst";
const MAX_ROW_ID_LENGTH = 36;
const TITLE_MAX = 500;
const DESCRIPTION_MAX = 8000;
const SHORT_DESCRIPTION_MAX = 500;
const LOCATION_MAX = 50;
const TICKET_URL_MAX = 255;
const IMAGE_MAX = 200;
const SLUG_MAX = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

const NON_ALNUM = /[^a-zA-Z0-9]/g;
const HTML_TAG = /<[^>]*>/g;
const HTML_ESCAPE_CHARS = /[&<>"']/g;
const WHITESPACE = /\s+/g;
const SLUG_STRIP = /[^a-z0-9\s-]/g;
const SLUG_SPACES = /\s+/g;
const SLUG_DASHES = /-+/g;
const SLUG_TRIM = /^-+|-+$/g;

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Maps a Tickster organizer query to the BISO campus it should be stamped as. */
export interface TicksterCampusQuery {
  campusId: string;
  label: string;
  query: string;
}

/**
 * Default per-campus queries (organizer strategy). The organizer names below are
 * a best guess — the operator MUST confirm them against the real Tickster
 * organizer accounts and override via `TICKSTER_EVENTS_QUERY_MAP` if different.
 */
const DEFAULT_CAMPUS_QUERIES: readonly TicksterCampusQuery[] = [
  { campusId: "1", label: "Oslo", query: 'by:"BISO Oslo"' },
  { campusId: "2", label: "Bergen", query: 'by:"BISO Bergen"' },
  { campusId: "3", label: "Trondheim", query: 'by:"BISO Trondheim"' },
  { campusId: "4", label: "Stavanger", query: 'by:"BISO Stavanger"' },
  { campusId: "5", label: "National", query: 'by:"BISO National"' },
];

export interface TicksterEventsSyncConfig {
  apiKey: string;
  authHeader?: string;
  baseUrl?: string;
  databaseId: string;
  /** Fetch the per-event detail endpoint to enrich image + price. */
  enrich: boolean;
  eventsTableId: string;
  /** Tickster `eventHierarchyType` values to import (others are skipped). */
  hierarchyTypes: string[];
  queries: TicksterCampusQuery[];
  /** Status stamped on every synced event row. */
  status: string;
  take: number;
  translationsTableId: string;
  version?: string;
}

export interface TicksterEventsSyncFailure {
  id: string;
  reason: string;
}

export interface TicksterEventsSyncResult {
  campusesQueried: number;
  failed: TicksterEventsSyncFailure[];
  fetched: number;
  skipped: number;
  translationsUpserted: number;
  upserted: number;
}

interface SyncLogger {
  error: (message: string) => void;
  log: (message: string) => void;
}

interface SyncTicksterEventsOptions {
  client?: TicksterEventsClient;
  config: TicksterEventsSyncConfig;
  db: TablesDB;
  logger?: SyncLogger;
  now?: () => Date;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }
  return !(value === "false" || value === "0" || value === "");
}

function parseCampusQueries(raw: string | undefined): TicksterCampusQuery[] {
  if (!raw) {
    return [...DEFAULT_CAMPUS_QUERIES];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_CAMPUS_QUERIES];
    }
    const mapped = parsed
      .map((entry): TicksterCampusQuery | null => {
        if (!(entry && typeof entry === "object")) {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const query = record.query;
        const campusId = record.campusId ?? record.campus_id;
        if (typeof query !== "string" || typeof campusId !== "string") {
          return null;
        }
        const label =
          typeof record.label === "string" ? record.label : campusId;
        return { campusId, label, query };
      })
      .filter((entry): entry is TicksterCampusQuery => entry !== null);
    return mapped.length > 0 ? mapped : [...DEFAULT_CAMPUS_QUERIES];
  } catch {
    return [...DEFAULT_CAMPUS_QUERIES];
  }
}

export function getTicksterEventsSyncConfig(
  env: NodeJS.ProcessEnv = process.env
): TicksterEventsSyncConfig | null {
  // Tickster issues a single API key; the Event API reuses TICKSTER_API_KEY.
  // Treat blank/whitespace as absent so an empty `.env` value reads as unset.
  const apiKey = env.TICKSTER_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return {
    apiKey,
    authHeader: env.TICKSTER_AUTH_HEADER,
    baseUrl: env.TICKSTER_EVENTS_BASE_URL,
    databaseId: env.APPWRITE_DATABASE_ID ?? DEFAULT_DATABASE_ID,
    enrich: parseBoolean(env.TICKSTER_EVENTS_ENRICH, true),
    eventsTableId: env.APPWRITE_EVENTS_TABLE_ID ?? DEFAULT_EVENTS_TABLE_ID,
    hierarchyTypes: (env.TICKSTER_EVENTS_HIERARCHY_TYPES ?? "event")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    queries: parseCampusQueries(env.TICKSTER_EVENTS_QUERY_MAP),
    status: env.TICKSTER_EVENTS_STATUS ?? DEFAULT_STATUS,
    take: Math.min(
      parsePositiveInteger(env.TICKSTER_EVENTS_TAKE, DEFAULT_TAKE),
      MAX_TAKE
    ),
    translationsTableId:
      env.APPWRITE_TRANSLATIONS_TABLE_ID ?? DEFAULT_TRANSLATIONS_TABLE_ID,
    version: env.TICKSTER_EVENTS_API_VERSION,
  };
}

export function getTicksterEventsSyncSecret(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  // CRON_SECRET is the single shared secret for every scheduled endpoint.
  // TICKSTER_SYNC_SECRET is a deprecated fallback for older deployments.
  return env.CRON_SECRET ?? env.TICKSTER_SYNC_SECRET;
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getErrorCode(error: unknown): number | undefined {
  if (!(typeof error === "object" && error !== null && "code" in error)) {
    return;
  }
  const { code } = error as { code?: unknown };
  if (typeof code === "number") {
    return code;
  }
  if (typeof code === "string") {
    const parsed = Number.parseInt(code, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return;
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function stripHtml(value: string): string {
  return value.replace(HTML_TAG, " ").replace(WHITESPACE, " ").trim();
}

function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_CHARS, (char) => HTML_ESCAPE[char] ?? char);
}

function buildEventRowId(ticksterId: string): string {
  return `${ROW_ID_PREFIX}${ticksterId.replace(NON_ALNUM, "")}`.slice(
    0,
    MAX_ROW_ID_LENGTH
  );
}

function buildSlug(name: string, ticksterId: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(SLUG_STRIP, "")
    .replace(SLUG_SPACES, "-")
    .replace(SLUG_DASHES, "-")
    .replace(SLUG_TRIM, "");
  const suffix = ticksterId.toLowerCase().replace(NON_ALNUM, "");
  const slug = base ? `${base}-${suffix}` : `tickster-${suffix}`;
  return truncate(slug, SLUG_MAX);
}

function pickLocation(venue: TicksterVenue | null | undefined): string | null {
  if (!venue) {
    return null;
  }
  const parts = [venue.name, venue.city].filter(
    (part): part is string => typeof part === "string" && part.length > 0
  );
  return parts.length > 0 ? truncate(parts.join(", "), LOCATION_MAX) : null;
}

/**
 * Tickster descriptions are external, untrusted HTML, but the web renderer
 * (`PlateContentRenderer`) injects any value starting with `<` via
 * `dangerouslySetInnerHTML` on the assumption it was authored by trusted CMS
 * staff. Strip all markup to text, escape it, and wrap it in a single paragraph
 * so the stored value is safe to render as-is (no scripts, handlers, or links
 * survive). Rich formatting is intentionally dropped in favour of safety.
 */
function descriptionToHtml(
  description: TicksterEventListItem["description"]
): string {
  const text = stripHtml(description?.html ?? description?.markdown ?? "");
  if (!text) {
    return "";
  }
  const body = escapeHtml(truncate(text, DESCRIPTION_MAX));
  return truncate(`<p>${body}</p>`, DESCRIPTION_MAX);
}

function clampImageUrl(url: string | null | undefined): string | null {
  // The `events.image` column is capped at 200 chars; a longer CDN URL would
  // fail the whole upsert, so drop it (the UI falls back to a placeholder).
  return url && url.length <= IMAGE_MAX ? url : null;
}

function buildShortDescription(
  description: TicksterEventListItem["description"]
): string | null {
  const text = stripHtml(description?.html ?? description?.markdown ?? "");
  return text ? truncate(text, SHORT_DESCRIPTION_MAX) : null;
}

interface PriceInfo {
  amount: number | null;
  currency: string | null;
}

/** Cheapest ticket/variant price across the detail payload's products. */
function pickPrice(detail: TicksterEventDetail | null): PriceInfo {
  if (!detail) {
    return { amount: null, currency: null };
  }
  const prices: PriceInfo[] = [];
  for (const product of detail.products) {
    if (product.price) {
      prices.push(product.price);
    }
    for (const variant of product.variants) {
      if (variant.price) {
        prices.push(variant.price);
      }
    }
  }
  let amount: number | null = null;
  let currency: string | null = null;
  for (const price of prices) {
    if (price.amount !== null && (amount === null || price.amount < amount)) {
      amount = price.amount;
      currency = price.currency;
    }
  }
  return { amount, currency };
}

function eventPermissions(status: string): string[] {
  const team = Role.team(OPERATIONS_TEAM_ID);
  // Published rows are world-readable; drafts stay team-only so review-before-
  // publish imports don't leak publicly through Appwrite (mirrors the
  // status-aware admin permission model).
  const read =
    status === "published"
      ? Permission.read(Role.any())
      : Permission.read(team);
  return [read, Permission.update(team), Permission.delete(team)];
}

interface BuildEventArgs {
  campusId: string;
  detail: TicksterEventDetail | null;
  item: TicksterEventListItem;
  status: string;
  syncedAt: string;
}

function buildEventMetadata(args: BuildEventArgs, price: PriceInfo): string {
  const { item, detail, syncedAt } = args;
  return JSON.stringify({
    source: "tickster",
    tickster_id: item.id,
    info_url: item.infoUrl ?? undefined,
    shop_url: item.shopUrl ?? detail?.shopUrl ?? undefined,
    state: item.state ?? undefined,
    hierarchy_type: item.eventHierarchyType ?? undefined,
    parent_event_id: item.parentEventId || undefined,
    currency: price.currency ?? undefined,
    last_updated_utc:
      item.lastUpdatedUtc ?? detail?.lastUpdatedUtc ?? undefined,
    synced_at: syncedAt,
    // The web event card reads `metadata.category` for its badge.
    category: "Social",
  });
}

function buildEventData(args: BuildEventArgs): Record<string, unknown> {
  const { item, detail, campusId, status } = args;
  const venue = item.venue ?? detail?.venue ?? null;
  const ticketUrl = item.shopUrl ?? detail?.shopUrl ?? null;
  const price = pickPrice(detail);
  const name = item.name ?? "Untitled event";
  return {
    slug: buildSlug(name, item.id),
    status,
    campus_id: campusId,
    metadata: buildEventMetadata(args, price),
    start_date: item.startUtc ?? null,
    end_date: item.endUtc ?? null,
    image: clampImageUrl(detail?.imageUrl),
    ticket_url: ticketUrl ? truncate(ticketUrl, TICKET_URL_MAX) : null,
    price: price.amount,
    location: pickLocation(venue),
    is_collection: item.eventHierarchyType === "collection",
    member_only: false,
  };
}

function buildTranslationData(
  eventRowId: string,
  locale: "no" | "en",
  source: TicksterEventListItem
): Record<string, unknown> {
  const shortDescription = buildShortDescription(source.description);
  return {
    // Link via the relationship (read by the web app) AND the plain content_id
    // (read by the admin single-event join) — belt and suspenders.
    event_ref: eventRowId,
    content_id: eventRowId,
    content_type: "event",
    locale,
    title: truncate(source.name ?? "Untitled event", TITLE_MAX),
    description: descriptionToHtml(source.description),
    short_description: shortDescription,
    additional_fields: shortDescription
      ? JSON.stringify({ short_description: shortDescription })
      : null,
  };
}

async function upsertRow(
  db: TablesDB,
  options: {
    data: Record<string, unknown>;
    databaseId: string;
    permissions: string[];
    rowId: string;
    tableId: string;
  }
): Promise<void> {
  const { data, databaseId, permissions, rowId, tableId } = options;
  try {
    await db.updateRow({ data, databaseId, permissions, rowId, tableId });
  } catch (error) {
    if (getErrorCode(error) !== HTTP_NOT_FOUND) {
      throw error;
    }
    try {
      await db.createRow({ data, databaseId, permissions, rowId, tableId });
    } catch (createError) {
      if (getErrorCode(createError) !== HTTP_CONFLICT) {
        throw createError;
      }
      await db.updateRow({ data, databaseId, permissions, rowId, tableId });
    }
  }
}

interface UpsertEventContext {
  config: TicksterEventsSyncConfig;
  db: TablesDB;
  result: TicksterEventsSyncResult;
  syncedAt: string;
}

/** Upsert one event row plus its `no`/`en` translation rows. */
async function upsertEvent(
  context: UpsertEventContext,
  args: {
    campusId: string;
    detail: TicksterEventDetail | null;
    enItem: TicksterEventListItem | null;
    nbItem: TicksterEventListItem;
  }
): Promise<void> {
  const { config, db, result, syncedAt } = context;
  const { nbItem, enItem, detail, campusId } = args;
  const rowId = buildEventRowId(nbItem.id);
  const permissions = eventPermissions(config.status);

  await upsertRow(db, {
    data: buildEventData({
      campusId,
      detail,
      item: nbItem,
      status: config.status,
      syncedAt,
    }),
    databaseId: config.databaseId,
    permissions,
    rowId,
    tableId: config.eventsTableId,
  });
  result.upserted += 1;

  const translations: { locale: "no" | "en"; source: TicksterEventListItem }[] =
    [
      { locale: "no", source: nbItem },
      { locale: "en", source: enItem ?? nbItem },
    ];
  for (const { locale, source } of translations) {
    await upsertTranslation(db, config, {
      eventRowId: rowId,
      locale,
      permissions,
      source,
    });
    result.translationsUpserted += 1;
  }
}

/**
 * Upsert one event translation. Rows are matched by the (content_id, locale)
 * pair via the existing `idx_content_locale` index and created with a random id
 * — mirroring the admin event flow, and avoiding encoding the locale into the
 * Appwrite row id (which can overflow the 36-char id limit for long ids).
 */
async function upsertTranslation(
  db: TablesDB,
  config: TicksterEventsSyncConfig,
  args: {
    eventRowId: string;
    locale: "no" | "en";
    permissions: string[];
    source: TicksterEventListItem;
  }
): Promise<void> {
  const { eventRowId, locale, permissions, source } = args;
  const existing = await db.listRows({
    databaseId: config.databaseId,
    queries: [
      Query.equal("content_type", "event"),
      Query.equal("content_id", eventRowId),
      Query.equal("locale", locale),
      Query.limit(1),
    ],
    tableId: config.translationsTableId,
  });
  const data = buildTranslationData(eventRowId, locale, source);
  const existingRow = existing.rows[0];
  if (existingRow) {
    await db.updateRow({
      data,
      databaseId: config.databaseId,
      permissions,
      rowId: existingRow.$id,
      tableId: config.translationsTableId,
    });
    return;
  }
  await db.createRow({
    data,
    databaseId: config.databaseId,
    permissions,
    rowId: ID.unique(),
    tableId: config.translationsTableId,
  });
}

async function enrichEvent(
  client: TicksterEventsClient,
  config: TicksterEventsSyncConfig,
  eventId: string,
  logger: SyncLogger | undefined
): Promise<TicksterEventDetail | null> {
  if (!config.enrich) {
    return null;
  }
  try {
    return await client.getEvent("nb", eventId);
  } catch (error) {
    logger?.error(
      `Tickster events: detail fetch failed for ${eventId}: ${formatError(error)}`
    );
    return null;
  }
}

interface CampusContext {
  client: TicksterEventsClient;
  config: TicksterEventsSyncConfig;
  db: TablesDB;
  logger: SyncLogger | undefined;
  result: TicksterEventsSyncResult;
  seen: Set<string>;
  syncedAt: string;
}

/** Process one list item: filter, dedupe, enrich, and upsert. */
async function processItem(
  context: CampusContext,
  campusQuery: TicksterCampusQuery,
  nbItem: TicksterEventListItem,
  enById: Map<string, TicksterEventListItem>
): Promise<void> {
  const { client, config, db, logger, result, seen, syncedAt } = context;
  result.fetched += 1;
  const hierarchy = nbItem.eventHierarchyType ?? "event";
  if (!config.hierarchyTypes.includes(hierarchy)) {
    result.skipped += 1;
    return;
  }
  if (seen.has(nbItem.id)) {
    result.skipped += 1;
    return;
  }
  seen.add(nbItem.id);
  try {
    const detail = await enrichEvent(client, config, nbItem.id, logger);
    await upsertEvent(
      { config, db, result, syncedAt },
      {
        campusId: campusQuery.campusId,
        detail,
        enItem: enById.get(nbItem.id) ?? null,
        nbItem,
      }
    );
  } catch (error) {
    result.failed.push({ id: nbItem.id, reason: formatError(error) });
    logger?.error(
      `Tickster events: failed to upsert ${nbItem.id}: ${formatError(error)}`
    );
  }
}

/**
 * Fetch + upsert every event for one campus query (both locales). Pages through
 * the result set with `skip`/`take` until all `totalItems` are processed, so a
 * campus with more than one page of events isn't silently truncated.
 */
async function processCampusQuery(
  context: CampusContext,
  campusQuery: TicksterCampusQuery
): Promise<void> {
  const { client, config, logger } = context;
  let skip = 0;
  let total = Number.POSITIVE_INFINITY;
  let page = 0;

  while (skip < total && page < MAX_PAGES_PER_CAMPUS) {
    const baseParams: Omit<ListTicksterEventsParams, "languageCode"> = {
      query: campusQuery.query,
      skip,
      take: config.take,
    };
    const [nbList, enList] = await Promise.all([
      client.listEvents({ ...baseParams, languageCode: "nb" }),
      client.listEvents({ ...baseParams, languageCode: "en" }),
    ]);
    page += 1;
    total = nbList.totalItems;
    const enById = new Map(enList.items.map((item) => [item.id, item]));
    logger?.log(
      `Tickster events: campus ${campusQuery.label} (${campusQuery.campusId}) "${campusQuery.query}" page ${page} → ${nbList.items.length}/${total} item(s)`
    );

    if (nbList.items.length === 0) {
      break;
    }
    for (const nbItem of nbList.items) {
      await processItem(context, campusQuery, nbItem, enById);
    }
    skip += nbList.items.length;
  }

  if (page >= MAX_PAGES_PER_CAMPUS && skip < total) {
    logger?.error(
      `Tickster events: campus ${campusQuery.label} reached the ${MAX_PAGES_PER_CAMPUS}-page cap at ${skip}/${total}; remaining events were not synced this run.`
    );
  }
}

async function createClient(
  config: TicksterEventsSyncConfig
): Promise<TicksterEventsClient> {
  const { createTicksterEventsClient } = await import(
    "@repo/connectors/tickster"
  );
  return createTicksterEventsClient({
    apiKey: config.apiKey,
    authHeader: config.authHeader,
    baseUrl: config.baseUrl,
    version: config.version,
  });
}

export async function syncTicksterEvents(
  options: SyncTicksterEventsOptions
): Promise<TicksterEventsSyncResult> {
  const { config, db, logger, now = () => new Date() } = options;
  const client = options.client ?? (await createClient(config));

  const result: TicksterEventsSyncResult = {
    campusesQueried: 0,
    failed: [],
    fetched: 0,
    skipped: 0,
    translationsUpserted: 0,
    upserted: 0,
  };
  const seen = new Set<string>();
  const syncedAt = now().toISOString();

  for (const campusQuery of config.queries) {
    result.campusesQueried += 1;
    try {
      await processCampusQuery(
        { client, config, db, logger, result, seen, syncedAt },
        campusQuery
      );
    } catch (error) {
      logger?.error(
        `Tickster events: campus query "${campusQuery.query}" failed: ${formatError(error)}`
      );
      result.failed.push({
        id: campusQuery.query,
        reason: formatError(error),
      });
    }
  }

  logger?.log(
    `Tickster events sync: ${result.upserted} event(s), ${result.translationsUpserted} translation(s) upserted across ${result.campusesQueried} campus query(ies); ${result.skipped} skipped, ${result.failed.length} failed.`
  );
  return result;
}
