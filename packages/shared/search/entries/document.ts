import type { Documents } from "@repo/api/types/appwrite";
import { DocumentsScope, DocumentsStatus } from "@repo/api/types/appwrite";
import {
  ALL_CAMPUSES,
  campusBucket,
  SEARCH_LOCALES,
  type SearchEntry,
  type SearchLocale,
} from "../types";
import { baseEntry, type MapContext, nonEmpty, textFields } from "./common";

type DocumentRow = Pick<
  Documents,
  | "$id"
  | "title"
  | "description"
  | "category"
  | "status"
  | "campus_id"
  | "scope"
  | "language"
>;

export function documentEntries(
  row: DocumentRow,
  ctx: MapContext
): SearchEntry[] {
  if (row.status !== DocumentsStatus.PUBLISHED) {
    return [];
  }
  const textLocale: SearchLocale = row.language === "en" ? "en" : "no";
  const text = textFields({
    locale: textLocale,
    title: row.title,
    description: row.description,
    short_description: null,
  });
  const campusId =
    row.scope === DocumentsScope.NATIONAL
      ? ALL_CAMPUSES
      : campusBucket(row.campus_id);

  return SEARCH_LOCALES.map((locale) => ({
    ...baseEntry(
      {
        type: "document",
        rowId: row.$id,
        locale,
        textLocale,
        campusId,
        url: `/api/documents/${row.$id}/download`,
      },
      ctx
    ),
    ...text,
    category: nonEmpty(row.category),
  }));
}
