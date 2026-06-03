import { ID, Query, type TablesDB } from "@repo/api";
import {
  createTicksterClient,
  type TicksterClient,
  type TicksterEventMapping,
  type TicksterPurchase,
} from "@repo/connectors/tickster";

const DATABASE_ID = "app";
const ATTENDEES_TABLE_ID = "event_attendees";
const ATTENDEE_SOURCE = "tickster";
const DEFAULT_MAX_PAGES = 50;

/**
 * Drop-in Tickster → `event_attendees` sync. Mirrors the Entur departures sync
 * pattern (env-driven config + a secret-gated route) so the operator can pull
 * ticket buyers for mapped events on a schedule and feed the existing segment /
 * assignment / "Your trip" pipeline. It writes the same rows the admin CSV
 * import produces, so nothing downstream needs to change.
 *
 * Inert until `TICKSTER_API_KEY`, `TICKSTER_EOG_CODE` and a `TICKSTER_EVENT_MAP`
 * are configured — and the exact CRM field names are confirmed against the live
 * API (see `@repo/connectors/tickster` types).
 */

export interface TicksterSyncConfig {
  apiKey: string;
  baseUrl?: string;
  eogCode: string;
  /** Tickster event id → internal Appwrite event mapping. */
  eventMap: TicksterEventMapping[];
}

export interface TicksterSyncResult {
  imported: number;
  lastCursor: string | null;
  matched: number;
  pages: number;
  skipped: number;
}

/** Resolve a Tickster email to an internal Appwrite user id (or null). */
type UserMatcher = (email: string) => Promise<string | null>;

interface SyncLogger {
  error: (message: string) => void;
  log: (message: string) => void;
}

interface SyncTicksterOptions {
  client?: TicksterClient;
  config: TicksterSyncConfig;
  db: TablesDB;
  /** Cursor to resume from; omit for a full pull. */
  fromPurchase?: string;
  logger?: SyncLogger;
  /** Optional email→userId matcher (provided by the route via the Users API). */
  matchUser?: UserMatcher;
  maxPages?: number;
}

function parseEventMap(raw: string | undefined): TicksterEventMapping[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry): TicksterEventMapping | null => {
        if (!(entry && typeof entry === "object")) {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const ticksterEventId =
          record.ticksterEventId ?? record.tickster_event_id;
        const eventId = record.eventId ?? record.event_id;
        if (
          typeof ticksterEventId !== "string" ||
          typeof eventId !== "string"
        ) {
          return null;
        }
        const campusId = record.campusId ?? record.campus_id;
        return {
          ticksterEventId,
          eventId,
          campusId: typeof campusId === "string" ? campusId : null,
        };
      })
      .filter((entry): entry is TicksterEventMapping => entry !== null);
  } catch {
    return [];
  }
}

export function getTicksterSyncConfig(
  env: NodeJS.ProcessEnv = process.env
): TicksterSyncConfig | null {
  const apiKey = env.TICKSTER_API_KEY;
  const eogCode = env.TICKSTER_EOG_CODE;
  if (!(apiKey && eogCode)) {
    return null;
  }
  return {
    apiKey,
    eogCode,
    baseUrl: env.TICKSTER_BASE_URL,
    eventMap: parseEventMap(env.TICKSTER_EVENT_MAP),
  };
}

export function getTicksterSyncSecret(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  return env.TICKSTER_SYNC_SECRET;
}

async function upsertAttendee(
  db: TablesDB,
  data: {
    event_id: string;
    order_ref: string;
    email: string | null;
    name: string | null;
    phone: string | null;
    ticket_type: string | null;
    campus_id: string | null;
    matched_user_id: string | null;
  }
): Promise<void> {
  const existing = await db.listRows({
    databaseId: DATABASE_ID,
    tableId: ATTENDEES_TABLE_ID,
    queries: [
      Query.equal("event_id", data.event_id),
      Query.equal("order_ref", data.order_ref),
      Query.limit(1),
    ],
  });

  const payload = { ...data, source: ATTENDEE_SOURCE };
  const row = existing.rows[0];
  if (row) {
    await db.updateRow({
      data: payload,
      databaseId: DATABASE_ID,
      rowId: row.$id,
      tableId: ATTENDEES_TABLE_ID,
    });
    return;
  }
  await db.createRow({
    data: payload,
    databaseId: DATABASE_ID,
    rowId: ID.unique(),
    tableId: ATTENDEES_TABLE_ID,
  });
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveMatchedUser(
  email: string | null,
  matchUser: UserMatcher | undefined,
  logger: SyncLogger | undefined
): Promise<string | null> {
  if (!(email && matchUser)) {
    return null;
  }
  try {
    return await matchUser(email);
  } catch (error) {
    logger?.error(`Failed to match ${email}: ${formatError(error)}`);
    return null;
  }
}

/** Import one mapped purchase; returns whether it matched an app user. */
async function importPurchase(
  db: TablesDB,
  purchase: TicksterPurchase,
  mapping: TicksterEventMapping,
  matchUser: UserMatcher | undefined,
  logger: SyncLogger | undefined
): Promise<{ matched: boolean }> {
  const matchedUserId = await resolveMatchedUser(
    purchase.email,
    matchUser,
    logger
  );
  await upsertAttendee(db, {
    event_id: mapping.eventId,
    order_ref: purchase.reference,
    email: purchase.email,
    name: purchase.name,
    phone: purchase.phone,
    ticket_type: purchase.ticketType,
    campus_id: mapping.campusId,
    matched_user_id: matchedUserId,
  });
  return { matched: matchedUserId !== null };
}

/** Process one page of purchases, accumulating counts into [result]. */
async function processPurchases(
  purchases: TicksterPurchase[],
  mappingByTicksterEvent: Map<string, TicksterEventMapping>,
  context: {
    db: TablesDB;
    matchUser: UserMatcher | undefined;
    logger: SyncLogger | undefined;
  },
  result: TicksterSyncResult
): Promise<void> {
  for (const purchase of purchases) {
    const mapping = purchase.eventId
      ? mappingByTicksterEvent.get(purchase.eventId)
      : undefined;
    if (!mapping) {
      result.skipped += 1;
      continue;
    }
    try {
      const { matched } = await importPurchase(
        context.db,
        purchase,
        mapping,
        context.matchUser,
        context.logger
      );
      result.imported += 1;
      if (matched) {
        result.matched += 1;
      }
    } catch (error) {
      context.logger?.error(
        `Failed to upsert attendee ${purchase.reference}: ${formatError(error)}`
      );
    }
  }
}

export async function syncTicksterPurchases(
  options: SyncTicksterOptions
): Promise<TicksterSyncResult> {
  const {
    db,
    config,
    fromPurchase = "",
    matchUser,
    maxPages = DEFAULT_MAX_PAGES,
    logger,
  } = options;

  const client =
    options.client ??
    createTicksterClient({
      apiKey: config.apiKey,
      eogCode: config.eogCode,
      baseUrl: config.baseUrl,
    });

  const mappingByTicksterEvent = new Map(
    config.eventMap.map((entry) => [entry.ticksterEventId, entry])
  );

  const result: TicksterSyncResult = {
    pages: 0,
    imported: 0,
    matched: 0,
    skipped: 0,
    lastCursor: fromPurchase || null,
  };

  let cursor = fromPurchase;
  for (let page = 0; page < maxPages; page += 1) {
    const { purchases, nextCursor } = await client.getCrmPurchases(cursor);
    result.pages += 1;
    if (purchases.length === 0) {
      break;
    }

    await processPurchases(
      purchases,
      mappingByTicksterEvent,
      { db, matchUser, logger },
      result
    );

    result.lastCursor = nextCursor ?? cursor;
    if (!nextCursor || nextCursor === cursor) {
      break;
    }
    cursor = nextCursor;
  }

  logger?.log(
    `Tickster sync: ${result.imported} imported, ${result.matched} matched, ${result.skipped} skipped across ${result.pages} page(s).`
  );
  return result;
}
