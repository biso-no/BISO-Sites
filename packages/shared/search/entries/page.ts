import type { Pages } from "@repo/api/types/appwrite";
import { PagesStatus, PagesVisibility } from "@repo/api/types/appwrite";
import { toPlainText, truncateAtWord } from "../../utils/content-text";
import {
  isProjectNamespaceSlug,
  isProjectSlug,
  type ProjectSlug,
} from "../../utils/project-units";
import {
  isUnitPageSlug,
  parseUnitSubPageSlug,
  UNIT_PAGE_SLUG_PREFIX,
} from "../../utils/unit-urls";
import { pageDocText } from "../page-text";
import {
  campusBucket,
  SEARCH_LOCALES,
  type SearchEntry,
  type SearchLocale,
} from "../types";
import { baseEntry, type MapContext } from "./common";

export interface PageTranslationText {
  description: string | null;
  is_published: boolean | null;
  locale: SearchLocale;
  published_doc: string | null;
  title: string | null;
}

export type PageOwner =
  | { kind: "standalone" }
  | { kind: "unit"; unitSlug: string }
  | { kind: "unitSubPage"; unitSlug: string }
  | { kind: "project"; project: ProjectSlug }
  | { kind: "reserved" };

const UNIT_SEGMENTS = 3;
const SUMMARY_MAX = 200;

/** Who serves a page slug, decided from the slug alone. */
export function pageOwner(slug: string): PageOwner {
  const sub = parseUnitSubPageSlug(slug);
  if (sub) {
    return { kind: "unitSubPage", unitSlug: sub.unitSlug };
  }
  const normalized = slug.trim().toLowerCase();
  if (normalized.startsWith(UNIT_PAGE_SLUG_PREFIX)) {
    const segments = normalized.split("/");
    if (segments.length === UNIT_SEGMENTS && segments.every(Boolean)) {
      return { kind: "unit", unitSlug: normalized };
    }
    return { kind: "reserved" };
  }
  if (isUnitPageSlug(slug)) {
    return { kind: "reserved" };
  }
  if (isProjectNamespaceSlug(slug)) {
    const project = normalized.split("/")[1] ?? "";
    return normalized.split("/").length === 2 && isProjectSlug(project)
      ? { kind: "project", project }
      : { kind: "reserved" };
  }
  return { kind: "standalone" };
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses a stored page document; empty or invalid JSON gives null. */
export function parsePublishedDoc(raw: string | null): JsonObject | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** The document version `normalizePageDoc` accepts (`PAGE_DOC_VERSION`). */
const PAGE_DOC_VERSION = 2;

/**
 * `hasPageContent(normalizePageDoc(doc))`: anything but a version 2 document
 * with a `sections` array normalizes to an empty page. Of the rest, a section
 * counts when it is an object (`normalizePageDoc` drops other values) and a
 * header alone is content.
 */
function docHasContent(doc: JsonObject): boolean {
  if (doc.version !== PAGE_DOC_VERSION || !Array.isArray(doc.sections)) {
    return false;
  }
  const hasSection = doc.sections.some(
    (section) => typeof section === "object" && section !== null
  );
  return hasSection || isObject(doc.header);
}

/** Whether a translation has a published, non-empty document. */
export function hasPublishedContent(t: PageTranslationText): boolean {
  if (t.is_published !== true) {
    return false;
  }
  const doc = parsePublishedDoc(t.published_doc);
  return doc !== null && docHasContent(doc);
}

/**
 * The translation in exactly `locale` when it has published content, else
 * null. The site serves an editor page in the request locale only (`getPage`
 * matches the exact locale), so a page has an entry only where its own
 * translation is published.
 */
export function publishedTranslationIn(
  translations: PageTranslationText[],
  locale: SearchLocale
): PageTranslationText | null {
  const own = translations.find((t) => t.locale === locale);
  return own && hasPublishedContent(own) ? own : null;
}

/** The locales whose own translation has published content. */
export function publishedLocales(
  translations: PageTranslationText[]
): Set<SearchLocale> {
  return new Set(
    SEARCH_LOCALES.filter((locale) =>
      publishedTranslationIn(translations, locale)
    )
  );
}

/**
 * The published translation for `locale`, else the other locale's. Only for
 * text that stands in for something the site does fall back for (a unit's
 * page text on its unit entry), never for a page's own entries.
 */
export function publishedTranslationFor(
  translations: PageTranslationText[],
  locale: SearchLocale
): PageTranslationText | null {
  const published = translations.filter(hasPublishedContent);
  return published.find((t) => t.locale === locale) ?? published[0] ?? null;
}

export function pageSummary(t: PageTranslationText): string {
  return truncateAtWord(toPlainText(t.description), SUMMARY_MAX);
}

export function pageBody(t: PageTranslationText): string {
  return pageDocText(parsePublishedDoc(t.published_doc));
}

function titleOf(
  t: PageTranslationText,
  doc: JsonObject | null,
  slug: string
): string {
  const header = doc && isObject(doc.header) ? doc.header : null;
  const meta = doc && isObject(doc.meta) ? doc.meta : null;
  const candidates = [t.title, header?.title, meta?.title];
  for (const candidate of candidates) {
    const text = typeof candidate === "string" ? toPlainText(candidate) : "";
    if (text) {
      return text;
    }
  }
  return slug.split("/").at(-1) ?? slug;
}

type PageRow = Pick<
  Pages,
  "$id" | "slug" | "status" | "visibility" | "campus_id"
>;

/**
 * Entries for a standalone page, unit sub-page or project page: one per
 * locale whose own translation is published, with no fallback.
 */
export function pageEntries(
  row: PageRow,
  translations: PageTranslationText[],
  ctx: MapContext
): SearchEntry[] {
  const slug = row.slug?.trim();
  if (
    !slug ||
    row.status !== PagesStatus.PUBLISHED ||
    row.visibility !== PagesVisibility.PUBLIC
  ) {
    return [];
  }
  const { kind } = pageOwner(slug);
  if (kind === "unit" || kind === "reserved") {
    return [];
  }

  const entries: SearchEntry[] = [];
  for (const locale of SEARCH_LOCALES) {
    const t = publishedTranslationIn(translations, locale);
    if (!t) {
      continue;
    }
    const doc = parsePublishedDoc(t.published_doc);
    entries.push({
      ...baseEntry(
        {
          type: "page",
          rowId: row.$id,
          locale,
          textLocale: locale,
          campusId: campusBucket(row.campus_id),
          url: `/${slug}`,
        },
        ctx
      ),
      title: titleOf(t, doc, slug),
      summary: pageSummary(t),
      body: pageBody(t),
    });
  }
  return entries;
}
