import type { ContentTranslations, Events } from "@repo/api/types/appwrite";
import { EventsCategory, EventsPricingMode } from "@repo/api/types/appwrite";
import { formatOsloDate } from "@repo/shared/utils/oslo-time";

/**
 * Pure field derivations for the redesigned events views.
 *
 * These live apart from the components for two reasons: the components import
 * `server-only` transitively and so cannot be imported from a test, and every
 * one of these rules replaces something the current views get wrong against the
 * real data. Each is unit-tested in `events.test.ts`.
 */

/**
 * The eight values `events.category` can actually hold.
 *
 * The current list filters on `JSON.parse(events.metadata).category` against a
 * hardcoded five-value list (`Social · Career · Academic · Sports · Culture`)
 * that exists nowhere in the schema. `metadata` is **null on every published
 * row**, so `getEventCategory` falls through to its `"Social"` default for all
 * of them: today four of the five chips return nothing and the fifth returns
 * everything. The real column is a typed enum and is populated — this is it.
 */
export const EVENT_CATEGORIES: EventsCategory[] = Object.values(EventsCategory);

const CATEGORY_VALUES = new Set<string>(EVENT_CATEGORIES);

/** `?category=` → an enum member, or null for absent/unrecognised. */
export function parseCategory(
  raw: string | string[] | undefined
): EventsCategory | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value === "all") {
    return null;
  }
  return CATEGORY_VALUES.has(value) ? (value as EventsCategory) : null;
}

type Dated = Pick<Events, "end_date" | "start_date">;

/**
 * An event is past once it has ended — or, with no end, once it has started.
 *
 * The `/events` feed no longer needs this to order or split its rows: it asks
 * `listEvents` for `upcomingOnly`, which hides finished events and orders by
 * start date in the query, so the order holds across "Load more" pages (a
 * client-side sort could only ever reorder the page it had). It still marks a
 * finished event reached by direct link, and any card shown outside the feed.
 */
export function isPastEvent(event: Dated, now: Date): boolean {
  const ends = event.end_date ?? event.start_date;
  return ends === null ? false : new Date(ends).getTime() < now.getTime();
}

/**
 * The count to show for page 1 of the feed.
 *
 * A first page shorter than a page is the whole result, whatever the reported
 * total says — `countRows` in `lib/data/queries.ts` records Appwrite's
 * `listRows(...).total` reporting the whole table rather than the filtered set.
 * Where the total is right this is the same number.
 */
export function firstPageTotal(
  firstPageCount: number,
  reportedTotal: number,
  pageSize: number
): number {
  return firstPageCount < pageSize ? firstPageCount : reportedTotal;
}

/**
 * The `total` the "Load more" island tracks once it has fetched `page`.
 *
 * The island holds only the pages after the server-rendered first one, so its
 * total is the filtered total less page 1. A page shorter than `pageSize` is
 * the last one: what the island already held plus that page is then
 * everything, so a stale total cannot keep offering a "Load more" that loads
 * nothing.
 */
export function islandTotalAfterPage({
  firstPageCount,
  page,
  pageRows,
  pageSize,
  reportedTotal,
}: {
  firstPageCount: number;
  /** 1-based; the island's first fetch is page 2. */
  page: number;
  pageRows: number;
  pageSize: number;
  reportedTotal: number;
}): number {
  if (pageRows < pageSize) {
    return (page - 2) * pageSize + pageRows;
  }
  return reportedTotal - firstPageCount;
}

export type EventPrice =
  | { kind: "free" }
  | { kind: "paid"; amount: number; memberAmount: number | null }
  | { kind: "unknown" };

type Priced = Pick<Events, "member_price" | "price" | "pricing_mode">;

/**
 * `pricing_mode` is the authoritative field and is what the CMS writes; `price`
 * is null on every free row. The current views ignore `pricing_mode` entirely
 * and infer "Free" from a null price, which also labels a paid event whose
 * amount has not been entered yet as free. Member pricing comes from the real
 * `member_price` column, not from the null `metadata` blob.
 */
export function eventPrice(event: Priced): EventPrice {
  if (event.pricing_mode === EventsPricingMode.FREE) {
    return { kind: "free" };
  }
  if (event.price === null || event.price === undefined) {
    return { kind: "unknown" };
  }
  return {
    kind: "paid",
    amount: event.price,
    memberAmount:
      event.member_price !== null &&
      event.member_price !== undefined &&
      event.member_price !== event.price
        ? event.member_price
        : null,
  };
}

export interface EventContentFields {
  description: string;
  /** Locale the description came from, so a fallback can be disclosed. */
  descriptionLocale: string | null;
  shortDescription: string | null;
  title: string;
}

function translationsOf(refs: unknown): ContentTranslations[] {
  return Array.isArray(refs)
    ? refs.filter(
        (ref): ref is ContentTranslations =>
          typeof ref === "object" && ref !== null && "title" in ref
      )
    : [];
}

function firstNonEmpty(
  translations: ContentTranslations[],
  locale: string,
  field: "description" | "short_description" | "title"
): { locale: string; value: string } | null {
  const ordered = [
    ...translations.filter((t) => t.locale === locale),
    ...translations.filter((t) => t.locale !== locale),
  ];
  for (const translation of ordered) {
    const value = translation[field];
    if (typeof value === "string" && value.trim() !== "") {
      return { locale: translation.locale, value };
    }
  }
  return null;
}

/**
 * Resolve the text for one event, per field, preferring the reader's locale.
 *
 * Two of the three published events have a Norwegian translation row whose
 * `description` is an empty string and whose `short_description` is null — the
 * English row is the only one carrying body copy. The current detail page
 * filters `translation_refs` to the requested locale at the query, so a
 * Norwegian visitor gets a headline over a blank page. Falling back per field
 * shows content that exists rather than inventing any; `descriptionLocale`
 * lets the caller say so.
 */
export function pickContent(refs: unknown, locale: string): EventContentFields {
  const translations = translationsOf(refs);
  const description = firstNonEmpty(translations, locale, "description");
  return {
    title: firstNonEmpty(translations, locale, "title")?.value ?? "",
    shortDescription:
      firstNonEmpty(translations, locale, "short_description")?.value ?? null,
    description: description?.value ?? "",
    descriptionLocale: description?.locale ?? null,
  };
}

/**
 * Event times are Europe/Oslo wall-clock time, whatever zone the host runs in.
 *
 * The admin editor now converts its `<input type="datetime-local">` value from
 * Oslo time to a real UTC instant on the way in (`osloWallClockToIso`), so a
 * stored `2026-10-01T16:00:00.000+00:00` is 18:00 in Oslo. Reading it in UTC —
 * which was right while the editor stored the typed wall clock with a bare
 * `+00:00` stamp — would now print every event an hour or two early, and
 * reading it in the server's own zone makes the time depend on where the app
 * runs. Both formatters go through `@repo/shared/utils/oslo-time`, the same
 * helpers the admin app reads back with.
 */
export function formatEventDate(iso: string, locale: string): string {
  return (
    formatOsloDate(
      iso,
      { weekday: "long", day: "numeric", month: "long", year: "numeric" },
      locale
    ) ?? ""
  );
}

export function formatEventTime(iso: string, locale: string): string {
  return (
    formatOsloDate(
      iso,
      { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
      locale
    ) ?? ""
  );
}

/** "18:00 – 23:00", or just the start when there is no end. */
export function formatEventTimeRange(
  start: string | null,
  end: string | null,
  locale: string
): string | null {
  if (!start) {
    return null;
  }
  const from = formatEventTime(start, locale);
  return end ? `${from} – ${formatEventTime(end, locale)}` : from;
}
