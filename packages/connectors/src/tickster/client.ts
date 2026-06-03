import "server-only";

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

function toStringOrNull(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

/**
 * Defensive mapping of an unknown CRM record into our `TicksterPurchase`. The
 * Tickster field names are not yet verified against a live key, so we probe a
 * few likely aliases and fall back to null. Update the alias lists once the real
 * payload is known.
 */
function mapPurchase(raw: Record<string, unknown>): TicksterPurchase | null {
  const reference =
    toStringOrNull(raw.reference) ??
    toStringOrNull(raw.purchaseReference) ??
    toStringOrNull(raw.orderRef) ??
    toStringOrNull(raw.id);

  if (!reference) {
    return null;
  }

  return {
    reference,
    eventId:
      toStringOrNull(raw.eventId) ??
      toStringOrNull(raw.event_id) ??
      toStringOrNull(raw.event),
    email: toStringOrNull(raw.email) ?? toStringOrNull(raw.buyerEmail),
    name:
      toStringOrNull(raw.name) ??
      toStringOrNull(raw.buyerName) ??
      toStringOrNull(raw.customerName),
    phone: toStringOrNull(raw.phone) ?? toStringOrNull(raw.buyerPhone),
    ticketType:
      toStringOrNull(raw.ticketType) ?? toStringOrNull(raw.ticket_type),
    purchasedAt: toStringOrNull(raw.purchasedAt) ?? toStringOrNull(raw.created),
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
      toStringOrNull(container.nextCursor) ??
      toStringOrNull(container.next) ??
      toStringOrNull(container.fromPurchase);
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

  private async request(path: string): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        headers: {
          "X-API-KEY": this.apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          `Tickster API ${path} responded ${response.status} ${response.statusText}`
        );
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
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
    const id = toStringOrNull(raw.id) ?? eventId;
    return {
      id,
      name: toStringOrNull(raw.name),
      start: toStringOrNull(raw.start) ?? toStringOrNull(raw.startDate),
      venue: toStringOrNull(raw.venue),
    };
  }
}

export function createTicksterClient(
  config: TicksterClientConfig
): TicksterClient {
  return new TicksterClient(config);
}
