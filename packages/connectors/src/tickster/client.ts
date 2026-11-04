import "server-only";

import { asString, fetchTicksterJson } from "./common";
import type { TicksterCrmPage, TicksterEvent, TicksterPurchase } from "./types";

const DEFAULT_BASE_URL = "https://api.tickster.com";
const DEFAULT_TIMEOUT_MS = 15_000;
const TRAILING_SLASH = /\/$/;

export interface TicksterClientConfig {
  apiKey: string;
  baseUrl?: string;
  /** Organizer code (eogCode) used by the CRM endpoint. */
  eogCode: string;
  fetcher?: typeof fetch;
  fetchTimeoutMs?: number;
}

/**
 * Defensive mapping of an unknown CRM record into our `TicksterPurchase`. The
 * Tickster field names are not yet verified against a live key, so we probe a
 * few likely aliases and fall back to null. Update the alias lists once the real
 * payload is known.
 */
function mapPurchase(raw: Record<string, unknown>): TicksterPurchase | null {
  const reference =
    asString(raw.reference) ??
    asString(raw.purchaseReference) ??
    asString(raw.orderRef) ??
    asString(raw.id);

  if (!reference) {
    return null;
  }

  return {
    reference,
    eventId:
      asString(raw.eventId) ?? asString(raw.event_id) ?? asString(raw.event),
    email: asString(raw.email) ?? asString(raw.buyerEmail),
    name:
      asString(raw.name) ??
      asString(raw.buyerName) ??
      asString(raw.customerName),
    phone: asString(raw.phone) ?? asString(raw.buyerPhone),
    ticketType: asString(raw.ticketType) ?? asString(raw.ticket_type),
    purchasedAt: asString(raw.purchasedAt) ?? asString(raw.created),
  };
}

function extractRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[];
  }
  if (payload && typeof payload === "object") {
    const container = payload as Record<string, unknown>;
    for (const key of ["purchases", "items", "data", "results"]) {
      const value = container[key];
      if (Array.isArray(value)) {
        return value as Record<string, unknown>[];
      }
    }
  }
  return [];
}

function extractNextCursor(
  payload: unknown,
  purchases: TicksterPurchase[]
): string | null {
  if (payload && typeof payload === "object") {
    const container = payload as Record<string, unknown>;
    const explicit =
      asString(container.nextCursor) ??
      asString(container.next) ??
      asString(container.fromPurchase);
    if (explicit) {
      return explicit;
    }
  }
  // Fallback: use the last purchase reference as the incremental cursor.
  return purchases.at(-1)?.reference ?? null;
}

/**
 * Thin client over the Tickster public API. Authenticates with `X-API-KEY` and
 * exposes the CRM purchase feed (incrementally, via `fromPurchase`) plus single
 * event lookups.
 */
export class TicksterClient {
  private readonly apiKey: string;
  private readonly eogCode: string;
  private readonly baseUrl: string;
  private readonly fetchTimeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(config: TicksterClientConfig) {
    this.apiKey = config.apiKey;
    this.eogCode = config.eogCode;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(
      TRAILING_SLASH,
      ""
    );
    this.fetchTimeoutMs = config.fetchTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetcher = config.fetcher ?? fetch;
  }

  private request(path: string): Promise<unknown> {
    return fetchTicksterJson({
      apiKey: this.apiKey,
      authHeader: "X-API-KEY",
      fetcher: this.fetcher,
      label: `Tickster API ${path}`,
      timeoutMs: this.fetchTimeoutMs,
      url: `${this.baseUrl}${path}`,
    });
  }

  /**
   * Fetch one page of CRM purchases for the configured organizer.
   *
   * @param fromPurchase incremental cursor; omit/empty for the first page.
   */
  async getCrmPurchases(fromPurchase = ""): Promise<TicksterCrmPage> {
    const cursor = encodeURIComponent(fromPurchase);
    const payload = await this.request(`/crm/${this.eogCode}/${cursor}`);
    const purchases = extractRecords(payload)
      .map(mapPurchase)
      .filter((purchase): purchase is TicksterPurchase => purchase !== null);
    return {
      purchases,
      nextCursor: extractNextCursor(payload, purchases),
    };
  }

  async getEvent(eventId: string): Promise<TicksterEvent | null> {
    const payload = await this.request(
      `/events/${encodeURIComponent(eventId)}`
    );
    if (!(payload && typeof payload === "object")) {
      return null;
    }
    const raw = payload as Record<string, unknown>;
    const id = asString(raw.id) ?? eventId;
    return {
      id,
      name: asString(raw.name),
      start: asString(raw.start) ?? asString(raw.startDate),
      venue: asString(raw.venue),
    };
  }
}

export function createTicksterClient(
  config: TicksterClientConfig
): TicksterClient {
  return new TicksterClient(config);
}
