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
  if (!price || price === 0) {
    // An event with an external ticket link but no known price (e.g. a Tickster
    // event synced without enrichment) must not be advertised as "Free".
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
