/**
 * Tickster CRM/Event API types.
 *
 * Tickster is the external ticketing provider BISO uses for large events. The
 * public API (https://developer.tickster.com) exposes, among others, a CRM
 * endpoint that returns purchase records for an organizer:
 *
 *   GET /crm/{eogCode}/{fromPurchase}
 *
 * authenticated with an `X-API-KEY` header (or `api_key` query param), paginated
 * with an incremental `fromPurchase` cursor.
 *
 * NOTE: the exact response field names below are best-effort and MUST be
 * confirmed against the live API + a real organizer key before this connector
 * is relied upon. The parser in `client.ts` is intentionally defensive so a
 * field-name mismatch degrades gracefully (missing → null) rather than throwing.
 */

/** A single ticket buyer / purchase as returned by the CRM endpoint. */
export interface TicksterPurchase {
  email: string | null;
  /** Tickster event id this purchase belongs to. */
  eventId: string | null;
  name: string | null;
  phone: string | null;
  /** ISO timestamp of the purchase, when present. */
  purchasedAt: string | null;
  /** Tickster purchase/order reference — our idempotency key. */
  reference: string;
  /** Ticket type / category name, when present. */
  ticketType: string | null;
}

/** A page of CRM purchases plus the cursor to fetch the next page. */
export interface TicksterCrmPage {
  /**
   * Cursor to pass as `fromPurchase` on the next call. `null` when the API
   * signalled there are no further pages.
   */
  nextCursor: string | null;
  purchases: TicksterPurchase[];
}

/** Minimal Tickster event shape (from `GET /events/{id}`). */
export interface TicksterEvent {
  id: string;
  name: string | null;
  start: string | null;
  venue: string | null;
}

/**
 * Maps a Tickster event id to the internal Appwrite event it should feed.
 * Supplied by configuration (env `TICKSTER_EVENT_MAP`) so a sync run knows which
 * BISO event each purchase belongs to and which campus to stamp.
 */
export interface TicksterEventMapping {
  campusId: string | null;
  eventId: string;
  ticksterEventId: string;
}
