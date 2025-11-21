import type { ContentTranslations } from "@repo/api/types/appwrite";

export type EventMetadata = {
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  price?: number;
  ticket_url?: string;
  image?: string;
  units?: string[];
  department_id?: string;
  category?: string;
  attendees?: number;
  member_price?: number;
  highlights?: string[];
  agenda?: { time: string; activity: string }[];
  [key: string]: unknown;
};

interface EventWithTranslation extends ContentTranslations {
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

export type CollectionPricing = "bundle" | "individual";

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
  _memberPrice?: number | null
): string {
  if (!price || price === 0) {
    return "Free";
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
