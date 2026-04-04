import type { ContentTranslations, Events } from "@repo/api/types/appwrite";
import type { TranslationMap } from "@/lib/utils/content-translations";

export interface EventMetadata {
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

export const eventCategories = [
  "Social",
  "Career",
  "Academic",
  "Sports",
  "Culture",
] as const;
export type EventCategory = (typeof eventCategories)[number];

export type CollectionPricing = "bundle" | "individual";

export interface AdminEvent extends Events {
  metadata_parsed: EventMetadata;
  translation_refs: ContentTranslations[];
  translations: TranslationMap;
}

function _parseEventMetadata(
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

function _formatEventPrice(
  price: number | null | undefined,
  _memberPrice?: number | null
): string {
  if (!price || price === 0) {
    return "Free";
  }
  return `${price} NOK`;
}

function _getEventCategory(metadata: EventMetadata): EventCategory {
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
