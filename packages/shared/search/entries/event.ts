import type { Events } from "@repo/api/types/appwrite";
import { EventsPricingMode, EventsStatus } from "@repo/api/types/appwrite";
import {
  campusBucket,
  OPEN_ENDED,
  SEARCH_LOCALES,
  type SearchEntry,
  toUnixSeconds,
} from "../types";
import {
  baseEntry,
  keywordsOf,
  type MapContext,
  nonEmpty,
  type TranslationText,
  textFields,
  textFor,
} from "./common";

type EventRow = Pick<
  Events,
  | "$id"
  | "slug"
  | "status"
  | "campus_id"
  | "department_id"
  | "start_date"
  | "end_date"
  | "image"
  | "cover_pattern"
  | "price"
  | "member_price"
  | "pricing_mode"
  | "member_only"
  | "location"
  | "category"
  | "tags"
  | "collection_id"
  | "is_collection"
>;

function isPublicEvent(row: EventRow, now: Date): boolean {
  if (row.status !== EventsStatus.PUBLISHED) {
    return false;
  }
  // Same rule as the /events feed: collections and standalone events only.
  if (row.collection_id && row.is_collection !== true) {
    return false;
  }
  const end = row.end_date ?? row.start_date;
  const endSeconds = toUnixSeconds(end);
  return endSeconds === null || endSeconds * 1000 >= now.getTime();
}

export function eventEntries(
  row: EventRow,
  translations: TranslationText[],
  ctx: MapContext
): SearchEntry[] {
  if (!(row.slug && isPublicEvent(row, ctx.now))) {
    return [];
  }
  const entries: SearchEntry[] = [];
  for (const locale of SEARCH_LOCALES) {
    const text = textFor(translations, locale);
    if (!text) {
      return [];
    }
    entries.push({
      ...baseEntry(
        {
          type: "event",
          rowId: row.$id,
          locale,
          textLocale: text.locale,
          campusId: campusBucket(row.campus_id),
          url: `/events/${row.slug}`,
        },
        ctx
      ),
      ...textFields(text),
      keywords: keywordsOf(row.tags),
      category: nonEmpty(row.category),
      cover_pattern: nonEmpty(row.cover_pattern),
      department: ctx.departmentName(row.department_id),
      image: nonEmpty(row.image),
      location: nonEmpty(row.location),
      member_only: row.member_only === true,
      member_price: row.member_price ?? null,
      price:
        row.pricing_mode === EventsPricingMode.FREE ? 0 : (row.price ?? null),
      starts_at: toUnixSeconds(row.start_date),
      ends_at: toUnixSeconds(row.end_date),
      visible_until:
        toUnixSeconds(row.end_date ?? row.start_date) ?? OPEN_ENDED,
    });
  }
  return entries;
}
