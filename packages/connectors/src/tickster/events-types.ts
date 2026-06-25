/**
 * Tickster **Event API** types (https://event.api.tickster.com).
 *
 * This is a DIFFERENT API from the CRM/purchase feed in `types.ts`/`client.ts`:
 *
 *   GET /api/v{version}/{languageCode}/events            — search published events
 *   GET /api/v{version}/{languageCode}/events/{eventId}  — single event detail
 *
 * It returns the events an organizer has *published* to tickster.com, so BISO can
 * mirror its Tickster-ticketed events into the internal `events` table. The list
 * endpoint is intentionally lean (no image, no price); the detail endpoint adds
 * `imageUrl`, `products[].price`, performers, tags, etc.
 *
 * Field names below follow the documented Swagger schema. The parser in
 * `events-client.ts` is defensive (missing → null) so a partial payload degrades
 * gracefully rather than throwing.
 */

/** Language codes the Event API accepts on the `{languageCode}` path segment. */
export type TicksterLanguageCode = "sv" | "en" | "nb" | "da";

/** Event lifecycle state, e.g. "releasedForSale". */
export type TicksterEventState = string;

/** event / collection / production / production-child. */
export type TicksterEventHierarchyType = string;

export interface TicksterEventDescription {
  html: string | null;
  markdown: string | null;
}

export interface TicksterGeo {
  latitude: number | null;
  longitude: number | null;
}

export interface TicksterVenue {
  address: string | null;
  city: string | null;
  country: string | null;
  geo: TicksterGeo | null;
  id: string | null;
  name: string | null;
  zipCode: string | null;
}

export interface TicksterOrganizer {
  country: string | null;
  defaultLanguage: string | null;
  id: string | null;
  name: string | null;
}

export interface TicksterPrice {
  amount: number | null;
  currency: string | null;
}

export interface TicksterProductVariant {
  name: string | null;
  price: TicksterPrice | null;
}

export interface TicksterProduct {
  description: string | null;
  mainImageUrl: string | null;
  name: string | null;
  price: TicksterPrice | null;
  productType: string | null;
  variants: TicksterProductVariant[];
}

/** A single event as returned by the list endpoint (`/events`). */
export interface TicksterEventListItem {
  description: TicksterEventDescription | null;
  endUtc: string | null;
  eventHierarchyType: TicksterEventHierarchyType | null;
  id: string;
  infoUrl: string | null;
  lastUpdatedUtc: string | null;
  name: string | null;
  organizer: TicksterOrganizer | null;
  parentEventId: string | null;
  shopUrl: string | null;
  startUtc: string | null;
  state: TicksterEventState | null;
  venue: TicksterVenue | null;
}

/** Paged result wrapper from the list endpoint. */
export interface TicksterEventListResponse {
  items: TicksterEventListItem[];
  skipped: number;
  totalItems: number;
}

/** The richer single-event payload (`/events/{eventId}`). */
export interface TicksterEventDetail extends TicksterEventListItem {
  accessibilityInfo: string | null;
  ageLimit: string | null;
  curfewUtc: string | null;
  doorsOpenUtc: string | null;
  duration: string | null;
  imageUrl: string | null;
  localizedShopUrls: Record<string, string> | null;
  performers: string[];
  products: TicksterProduct[];
  stockLevel: string | null;
  tags: string[];
}
