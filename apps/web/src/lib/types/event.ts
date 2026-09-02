import type { ContentTranslations } from "@repo/api/types/appwrite";

interface EventMetadata {
  agenda?: { time: string; activity: string }[];
  attendees?: number;
  category?: string;
  department_id?: string;
  end_date?: string;
  end_time?: string;
  highlights?: string[];
  image?: string;
  location?: string;
  member_price?: number;
  price?: number;
  start_date?: string;
  start_time?: string;
  ticket_url?: string;
  units?: string[];
  [key: string]: unknown;
}

export interface EventWithTranslation extends ContentTranslations {
  event_ref: NonNullable<ContentTranslations["event_ref"]>;
}

export const eventCategories = [
  "Social",
  "Career",
  "Academic",
  "Sports",
  "Culture",
] as const;
export type EventCategory = (typeof eventCategories)[number];

type CollectionPricing = "bundle" | "individual";

/**
 * How (and whether) an event is signed up for.
 *
 * - `ticket` — `ticket_url` is set, so there is a real external ticketing flow.
 * - `expected` — registration is implied by `registration_deadline`,
 *   `capacity > 0` or `pricing_mode === "paid"`, but there is nothing to link
 *   to: BISO has no in-house sign-up flow yet, so the UI shows the deadline and
 *   capacity instead of a button that would do nothing.
 * - `none` — a drop-in event. No CTA at all; the UI says so plainly.
 */
export type EventRegistrationMode = "expected" | "none" | "ticket";

export interface EventRegistrationInfo {
  capacity: number | null;
  deadline: string | null;
  mode: EventRegistrationMode;
  ticketUrl: string | null;
}

interface EventRegistrationFields {
  capacity?: number | null;
  pricing_mode?: string | null;
  registration_deadline?: string | null;
  ticket_url?: string | null;
}

/**
 * Derives whether an event actually has a registration flow.
 *
 * The site used to render "Register now" on every event, including the many
 * drop-in ones ("bare møt opp") — and on those the button fired an analytics
 * ping and nothing else. There is no `registration_required` column and the
 * Appwrite schema is generated, so the signal is derived from columns that
 * already exist.
 */
export function resolveEventRegistration(
  event: EventRegistrationFields | null | undefined
): EventRegistrationInfo {
  const ticketUrl = event?.ticket_url?.trim() || null;
  const deadline = event?.registration_deadline?.trim() || null;
  const capacity =
    typeof event?.capacity === "number" && event.capacity > 0
      ? event.capacity
      : null;
  const isPaid = event?.pricing_mode === "paid";

  const resolveMode = (): EventRegistrationMode => {
    if (ticketUrl) {
      return "ticket";
    }
    if (deadline || capacity !== null || isPaid) {
      return "expected";
    }
    return "none";
  };

  return { capacity, deadline, mode: resolveMode(), ticketUrl };
}

/**
 * Href for the event detail route, or `null` when the event cannot be linked.
 *
 * `/events/[slug]` resolves through `getEventBySlug`, which matches the `slug`
 * COLUMN — linking to `$id` 404s. `slug` is optional in the schema, so rows
 * without one get no link at all rather than a broken URL.
 */
export function getEventHref(
  event: { slug?: string | null } | null | undefined
): string | null {
  const slug = event?.slug?.trim();
  return slug ? `/events/${encodeURIComponent(slug)}` : null;
}

export function parseEventMetadata(
  metadataString: string | null | undefined
): EventMetadata {
  if (!metadataString) {
    return {};
  }

  try {
    return JSON.parse(metadataString);
  } catch {
    return {};
  }
}

export function formatEventPrice(
  price: number | null | undefined,
  ticketUrl?: string | null
): string {
  // A genuine zero price is free, even with an external ticket link.
  if (price === 0) {
    return "Free";
  }
  // An unknown price (e.g. a Tickster event synced without enrichment) with an
  // external ticket link must not be advertised as "Free".
  if (price === null || price === undefined) {
    return ticketUrl ? "See tickets" : "Free";
  }
  return `${price} NOK`;
}

export function getEventCategory(metadata: EventMetadata): EventCategory {
  const category = metadata.category as EventCategory;
  return eventCategories.includes(category) ? category : "Social";
}

function _isCollectionEvent(event: ContentTranslations): boolean {
  return event.event_ref?.is_collection ?? false;
}

function _hasCollectionParent(event: ContentTranslations): boolean {
  return !!event.event_ref?.collection_id;
}

function _getCollectionPricing(
  event: ContentTranslations
): CollectionPricing | null {
  return event.event_ref?.collection_pricing ?? null;
}
