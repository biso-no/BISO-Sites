import type { Jobs } from "@repo/api/types/appwrite";
import { isRecruitmentVacancyOpen } from "../../types/recruitment";
import {
  campusBucket,
  OPEN_ENDED,
  SEARCH_LOCALES,
  type SearchEntry,
  toUnixSeconds,
} from "../types";
import {
  baseEntry,
  type MapContext,
  type TranslationText,
  textFields,
  textFor,
} from "./common";

type JobRow = Pick<
  Jobs,
  | "$id"
  | "slug"
  | "status"
  | "campus_id"
  | "department_id"
  | "application_deadline"
>;

export function jobEntries(
  row: JobRow,
  translations: TranslationText[],
  ctx: MapContext
): SearchEntry[] {
  if (
    !(
      row.slug &&
      isRecruitmentVacancyOpen(row.status, row.application_deadline, ctx.now)
    )
  ) {
    return [];
  }
  const deadline = toUnixSeconds(row.application_deadline);
  const entries: SearchEntry[] = [];
  for (const locale of SEARCH_LOCALES) {
    const text = textFor(translations, locale);
    if (!text) {
      return [];
    }
    entries.push({
      ...baseEntry(
        {
          type: "job",
          rowId: row.$id,
          locale,
          textLocale: text.locale,
          campusId: campusBucket(row.campus_id),
          url: `/jobs/${row.slug}`,
        },
        ctx
      ),
      ...textFields(text),
      deadline,
      department: ctx.departmentName(row.department_id),
      visible_until: deadline ?? OPEN_ENDED,
    });
  }
  return entries;
}
