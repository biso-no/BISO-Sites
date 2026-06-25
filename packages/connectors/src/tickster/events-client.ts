import "server-only";

import type {
  TicksterEventDescription,
  TicksterEventDetail,
  TicksterEventListItem,
  TicksterEventListResponse,
  TicksterGeo,
  TicksterLanguageCode,
  TicksterOrganizer,
  TicksterPrice,
  TicksterProduct,
  TicksterProductVariant,
  TicksterVenue,
} from "./events-types";

const DEFAULT_BASE_URL = "https://event.api.tickster.com";
const DEFAULT_VERSION = "1.0";
const DEFAULT_AUTH_HEADER = "X-API-KEY";
const DEFAULT_TIMEOUT_MS = 15_000;
/** Hard ceiling enforced by Tickster on the `take` query param. */
const MAX_TAKE = 100;
const TRAILING_SLASH = /\/$/;

export interface TicksterEventsClientConfig {
  apiKey: string;
  /**
   * Header carrying the API key. Tickster's public APIs use `X-API-KEY`; kept
   * configurable so the operator can adjust without a code change if the Event
   * API expects a different scheme.
   */
  authHeader?: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
  fetchTimeoutMs?: number;
  /** API version on the `/api/v{version}/` path segment. */
  version?: string;
}

export interface ListTicksterEventsParams {
  languageCode: TicksterLanguageCode;
  /** Search query, e.g. `BISO Oslo by:BISO Oslo`. Empty → all upcoming events. */
  query?: string;
  /** Results to skip (batch pagination). */
  skip?: number;
  /** Results to return (max 100). */
  take?: number;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => entry !== null);
}

function mapDescription(value: unknown): TicksterEventDescription | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  return {
    html: asString(record.html),
    markdown: asString(record.markdown),
  };
}

function mapGeo(value: unknown): TicksterGeo | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  return {
    latitude: asNumber(record.latitude),
    longitude: asNumber(record.longitude),
  };
}

function mapVenue(value: unknown): TicksterVenue | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  return {
    address: asString(record.address),
    city: asString(record.city),
    country: asString(record.country),
    geo: mapGeo(record.geo),
    id: asString(record.id),
    name: asString(record.name),
    zipCode: asString(record.zipCode),
  };
}

function mapOrganizer(value: unknown): TicksterOrganizer | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  return {
    country: asString(record.country),
    defaultLanguage: asString(record.defaultLanguage),
    id: asString(record.id),
    name: asString(record.name),
  };
}

function mapPrice(value: unknown): TicksterPrice | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  return {
    amount: asNumber(record.amount),
    currency: asString(record.currency),
  };
}

function mapVariant(value: unknown): TicksterProductVariant | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  return {
    name: asString(record.name),
    price: mapPrice(record.price),
  };
}

function mapProduct(value: unknown): TicksterProduct | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const variants = Array.isArray(record.variants)
    ? record.variants
        .map(mapVariant)
        .filter((entry): entry is TicksterProductVariant => entry !== null)
    : [];
  return {
    description: asString(record.description),
    mainImageUrl: asString(record.mainImageUrl),
    name: asString(record.name),
    price: mapPrice(record.price),
    productType: asString(record.productType),
    variants,
  };
}

function mapListItem(value: unknown): TicksterEventListItem | null {
  const record = asRecord(value);
  const id = record ? asString(record.id) : null;
  if (!(record && id)) {
    return null;
  }
  return {
    description: mapDescription(record.description),
    endUtc: asString(record.endUtc),
    eventHierarchyType: asString(record.eventHierarchyType),
    id,
    infoUrl: asString(record.infoUrl),
    lastUpdatedUtc: asString(record.lastUpdatedUtc),
    name: asString(record.name),
    organizer: mapOrganizer(record.organizer),
    parentEventId: asString(record.parentEventId),
    shopUrl: asString(record.shopUrl),
    startUtc: asString(record.startUtc),
    state: asString(record.state),
    venue: mapVenue(record.venue),
  };
}

function mapDetail(value: unknown): TicksterEventDetail | null {
  const base = mapListItem(value);
  const record = asRecord(value);
  if (!(base && record)) {
    return null;
  }
  const localized = asRecord(record.localizedShopUrls);
  const localizedShopUrls = localized
    ? Object.entries(localized).reduce<Record<string, string>>(
        (acc, [key, raw]) => {
          const url = asString(raw);
          if (url) {
            acc[key] = url;
          }
          return acc;
        },
        {}
      )
    : null;
  const products = Array.isArray(record.products)
    ? record.products
        .map(mapProduct)
        .filter((entry): entry is TicksterProduct => entry !== null)
    : [];
  return {
    ...base,
    accessibilityInfo: asString(record.accessibilityInfo),
    ageLimit: asString(record.ageLimit),
    curfewUtc: asString(record.curfewUtc),
    doorsOpenUtc: asString(record.doorsOpenUtc),
    duration: asString(record.duration),
    imageUrl: asString(record.imageUrl),
    localizedShopUrls,
    performers: asStringArray(record.performers),
    products,
    stockLevel: asString(record.stockLevel),
    tags: asStringArray(record.tags),
  };
}

/**
 * Thin, defensive client over the Tickster **Event API**. Authenticates with the
 * configured API-key header and exposes the published-event search + single-event
 * detail endpoints.
 */
export class TicksterEventsClient {
  private readonly apiKey: string;
  private readonly authHeader: string;
  private readonly baseUrl: string;
  private readonly version: string;
  private readonly fetchTimeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(config: TicksterEventsClientConfig) {
    this.apiKey = config.apiKey;
    this.authHeader = config.authHeader ?? DEFAULT_AUTH_HEADER;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(
      TRAILING_SLASH,
      ""
    );
    this.version = config.version ?? DEFAULT_VERSION;
    this.fetchTimeoutMs = config.fetchTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetcher = config.fetcher ?? fetch;
  }

  private async request(
    languageCode: TicksterLanguageCode,
    pathSuffix: string,
    searchParams?: URLSearchParams
  ): Promise<unknown> {
    const query = searchParams ? `?${searchParams.toString()}` : "";
    const url = `${this.baseUrl}/api/v${this.version}/${languageCode}/events${pathSuffix}${query}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    try {
      const response = await this.fetcher(url, {
        headers: {
          [this.authHeader]: this.apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          `Tickster Event API ${pathSuffix || "/events"} responded ${response.status} ${response.statusText}`
        );
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Search published events. Mirrors `GET /{languageCode}/events`. */
  async listEvents(
    params: ListTicksterEventsParams
  ): Promise<TicksterEventListResponse> {
    const search = new URLSearchParams();
    if (params.query) {
      search.set("query", params.query);
    }
    const take = Math.min(params.take ?? 20, MAX_TAKE);
    search.set("take", String(take));
    if (params.skip && params.skip > 0) {
      search.set("skip", String(params.skip));
    }

    const payload = await this.request(params.languageCode, "", search);
    const record = asRecord(payload);
    const items = Array.isArray(record?.items)
      ? record.items
          .map(mapListItem)
          .filter((entry): entry is TicksterEventListItem => entry !== null)
      : [];
    return {
      items,
      skipped: asNumber(record?.skipped) ?? 0,
      totalItems: asNumber(record?.totalItems) ?? items.length,
    };
  }

  /** Single-event detail. Mirrors `GET /{languageCode}/events/{eventId}`. */
  async getEvent(
    languageCode: TicksterLanguageCode,
    eventId: string
  ): Promise<TicksterEventDetail | null> {
    const payload = await this.request(
      languageCode,
      `/${encodeURIComponent(eventId)}`
    );
    return mapDetail(payload);
  }
}

export function createTicksterEventsClient(
  config: TicksterEventsClientConfig
): TicksterEventsClient {
  return new TicksterEventsClient(config);
}
