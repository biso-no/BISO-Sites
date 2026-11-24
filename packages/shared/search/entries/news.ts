import type { News } from "@repo/api/types/appwrite";
import { NewsStatus } from "@repo/api/types/appwrite";
import {
  campusBucket,
  SEARCH_LOCALES,
  type SearchEntry,
  toUnixSeconds,
} from "../types";
import {
  baseEntry,
  type MapContext,
  nonEmpty,
  type TranslationText,
  textFields,
  textIn,
} from "./common";

type NewsRow = Pick<
  News,
  | "$id"
  | "$createdAt"
  | "slug"
  | "status"
  | "campus_id"
  | "department_id"
  | "image"
>;

export function newsEntries(
  row: NewsRow,
  translations: TranslationText[],
  ctx: MapContext
): SearchEntry[] {
  if (row.status !== NewsStatus.PUBLISHED || !row.slug) {
    return [];
  }
  // `getNewsBySlug` reads the request locale's translation only: no fallback.
  const entries: SearchEntry[] = [];
  for (const locale of SEARCH_LOCALES) {
    const text = textIn(translations, locale);
    if (!text) {
      continue;
    }
    entries.push({
      ...baseEntry(
        {
          type: "news",
          rowId: row.$id,
          locale,
          textLocale: locale,
          campusId: campusBucket(row.campus_id),
          url: `/news/${row.slug}`,
        },
        ctx
      ),
      ...textFields(text),
      department: ctx.departmentName(row.department_id),
      image: nonEmpty(row.image),
      published_at: toUnixSeconds(row.$createdAt),
    });
  }
  return entries;
}
