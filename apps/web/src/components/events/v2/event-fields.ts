import type { ContentTranslations, Events } from "@repo/api/types/appwrite";
import { EventsCategory, EventsPricingMode } from "@repo/api/types/appwrite";

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

/** An event is past once it has ended — or, with no end, once it has started. */
export function isPastEvent(event: Dated, now: Date): boolean {
  const ends = event.end_date ?? event.start_date;
  return ends === null ? false : new Date(ends).getTime() < now.getTime();
}

function startMs(event: Dated): number {
  return event.start_date ? new Date(event.start_date).getTime() : 0;
}

/**
 * Feed order: soonest upcoming first, then past events most-recent first.
 *
 * `queryEvents` orders by `$createdAt` descending, which is the order rows were
 * typed into the CMS — on a calendar that is noise. Sorting here rather than in
 * the query keeps the shared reader (home, campus, students, nav) untouched.
 */
export function sortForFeed<T extends Dated>(events: T[], now: Date): T[] {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const event of events) {
    (isPastEvent(event, now) ? past : upcoming).push(event);
  }
  upcoming.sort((a, b) => startMs(a) - startMs(b));
  past.sort((a, b) => startMs(b) - startMs(a));
  return [...upcoming, ...past];
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
 * Event times are stored as the organiser's wall clock, so they are read back
 * as one.
 *
 * The admin editor binds `start_date` to a `<input type="datetime-local">` and
 * round-trips it with `value.slice(0, 16)` — no timezone conversion anywhere on
 * the write path — after which Appwrite stamps the string `+00:00`. So
 * `2026-10-01T18:00:00.000+00:00` means "the editor typed 18:00", not "18:00
 * UTC". The current views format with `date-fns` in the *server's* local zone,
 * which turns that into 20:00 on any CEST host and makes the time a property of
 * where the app happens to run. Formatting in UTC prints what was typed, on
 * every host.
 */
const UTC = "UTC";

export function formatEventDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: UTC,
  }).format(new Date(iso));
}

export function formatEventTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: UTC,
  }).format(new Date(iso));
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
