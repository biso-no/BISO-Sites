import {
  type ContentTranslations,
  EventsCategory,
} from "@repo/api/types/appwrite";

interface EventMetadata {
  agenda?: { time: string; activity: string }[];
  attendees?: number;
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

/**
 * The event's category, from the real `events.category` column.
 *
 * The admin editor writes this column; the web used to read
 * `metadata.category` and fall back to "Social" when absent — which it always
 * was, so every event rendered as Social. Returns null rather than defaulting,
 * so an uncategorised event shows no badge instead of a wrong one.
 */
export function resolveEventCategory(event: {
  category?: EventsCategory | null;
}): EventsCategory | null {
  return event.category ?? null;
}

/** i18n key under the `events.filters` namespace, per enum value. */
export const EVENT_CATEGORY_MESSAGE_KEYS: Record<EventsCategory, string> = {
  [EventsCategory.SOCIAL]: "social",
  [EventsCategory.CAREER]: "career",
  [EventsCategory.WORKSHOP]: "workshop",
  [EventsCategory.TALK]: "talk",
  [EventsCategory.PARTY]: "party",
  [EventsCategory.SPORT]: "sport",
  [EventsCategory.ACADEMIC]: "academic",
  [EventsCategory.TRIP]: "trip",
};

/**
 * Badge colours per category. Lives here rather than in each component: the
 * same map was previously triplicated verbatim across event-card, event-hero
 * and event-detail-modal.
 */
export const EVENT_CATEGORY_COLORS: Record<EventsCategory, string> = {
  [EventsCategory.SOCIAL]: "bg-purple-100 text-purple-700 border-purple-200",
  [EventsCategory.CAREER]: "bg-blue-100 text-blue-700 border-blue-200",
  [EventsCategory.ACADEMIC]: "bg-green-100 text-green-700 border-green-200",
  [EventsCategory.SPORT]: "bg-orange-100 text-orange-700 border-orange-200",
  [EventsCategory.PARTY]: "bg-pink-100 text-pink-700 border-pink-200",
  [EventsCategory.WORKSHOP]: "bg-amber-100 text-amber-700 border-amber-200",
  [EventsCategory.TALK]: "bg-indigo-100 text-indigo-700 border-indigo-200",
  [EventsCategory.TRIP]: "bg-teal-100 text-teal-700 border-teal-200",
};

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
