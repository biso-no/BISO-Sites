import type { Departments } from "@repo/api/types/appwrite";
import { unitDisplayName } from "../../utils/unit-names";
import { unitCanonicalPath } from "../../utils/unit-urls";
import { isPublicUnit } from "../../utils/unit-visibility";
import {
  campusBucket,
  SEARCH_LOCALES,
  type SearchEntry,
  type SearchLocale,
} from "../types";
import {
  baseEntry,
  bodyOf,
  type MapContext,
  nonEmpty,
  summaryOf,
  type TranslationText,
  textFor,
} from "./common";
import {
  type PageTranslationText,
  pageBody,
  pageSummary,
  publishedTranslationFor,
} from "./page";

type UnitRow = Pick<
  Departments,
  "$id" | "Name" | "slug" | "campus_id" | "active" | "logo" | "hero"
>;

interface UnitExtras {
  overlay: TranslationText[];
  page: PageTranslationText[] | null;
  /**
   * The locales in which a servable project page stands in for this unit's
   * own page (the site decides per request locale).
   */
  replacedIn: ReadonlySet<SearchLocale>;
}

export function unitEntries(
  row: UnitRow,
  extras: UnitExtras,
  ctx: MapContext
): SearchEntry[] {
  if (!isPublicUnit(row)) {
    return [];
  }
  const url = unitCanonicalPath({ campusId: row.campus_id, slug: row.slug });
  if (!url) {
    return [];
  }
  const title = unitDisplayName(row.Name);

  const locales = SEARCH_LOCALES.filter(
    (locale) => !extras.replacedIn.has(locale)
  );
  return locales.map((locale) => {
    const overlay = textFor(extras.overlay, locale);
    const page = overlay
      ? null
      : publishedTranslationFor(extras.page ?? [], locale);
    let text = { summary: "", body: "" };
    let textLocale = locale;
    if (overlay) {
      text = { summary: summaryOf(overlay), body: bodyOf(overlay) };
      textLocale = overlay.locale;
    } else if (page) {
      text = { summary: pageSummary(page), body: pageBody(page) };
      textLocale = page.locale;
    }
    return {
      ...baseEntry(
        {
          type: "unit",
          rowId: row.$id,
          locale,
          textLocale,
          campusId: campusBucket(row.campus_id),
          url,
        },
        ctx
      ),
      title,
      ...text,
      image: nonEmpty(row.logo),
    };
  });
}
