import type { SearchHit } from "@repo/shared/search/response";
import { ALL_CAMPUSES, type SearchLocale } from "@repo/shared/search/types";
import { formatOsloDate } from "@repo/shared/utils/oslo-time";

/**
 * The `search` namespace translator, structurally: `useTranslations("search")`
 * in a client component and `getTranslations("search")` on the server both fit.
 */
export type SearchTranslate = (
  key: string,
  values?: Record<string, string | number>
) => string;

export type LeadKind = "date" | "image" | null;

const PATH_END = /[?#]/;
const HYPHENS = /-+/g;
const META_SEPARATOR = " · ";
const MS_PER_SECOND = 1000;

/** The `Intl` locale for a search locale. */
export function intlLocaleOf(locale: SearchLocale): string {
  return locale === "no" ? "nb-NO" : "en-GB";
}

/** A Unix-seconds field from the index as a Date. */
export function dateOfSeconds(seconds: number): Date {
  return new Date(seconds * MS_PER_SECOND);
}

function joinMeta(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(META_SEPARATOR);
}

export function formatSeconds(
  seconds: number | null,
  options: Intl.DateTimeFormatOptions,
  locale: string
): string | null {
  return seconds === null
    ? null
    : formatOsloDate(dateOfSeconds(seconds), options, locale);
}

/** "winter-games" → "Winter games". */
function prettySegment(segment: string): string {
  const words = segment.replace(HYPHENS, " ").trim();
  return words.charAt(0).toLocaleUpperCase() + words.slice(1);
}

/** Where a page sits: its parent path, readable ("Projects / Winter games"). */
export function pageParents(url: string): string {
  return url
    .split(PATH_END)[0]
    .split("/")
    .filter(Boolean)
    .slice(0, -1)
    .map(prettySegment)
    .join(" / ");
}

export function productMeta(
  hit: SearchHit,
  locale: string,
  t: SearchTranslate
): string {
  const money = new Intl.NumberFormat(locale, {
    currency: "NOK",
    maximumFractionDigits: 0,
    style: "currency",
  });
  let member: string | null = null;
  if (hit.member_price === 0) {
    member = t("meta.freeForMembers");
  } else if (
    hit.member_price !== null &&
    hit.price !== null &&
    hit.member_price < hit.price
  ) {
    member = t("meta.memberPrice", { price: money.format(hit.member_price) });
  }
  // Buyers see in stock / out of stock only, never a count.
  return joinMeta([
    hit.price === null ? null : money.format(hit.price),
    member,
    hit.in_stock === false ? t("meta.outOfStock") : null,
  ]);
}

/** One short line under a result title: when, where, price or path. */
export function hitMeta(
  hit: SearchHit,
  locale: string,
  t: SearchTranslate
): string {
  const campus = hit.campus_id === ALL_CAMPUSES ? null : hit.campus_name;
  switch (hit.group) {
    case "event":
      return joinMeta([
        formatSeconds(
          hit.starts_at,
          { day: "numeric", month: "short", weekday: "short" },
          locale
        ),
        hit.location ?? campus,
      ]);
    case "news":
      return joinMeta([
        formatSeconds(
          hit.published_at,
          { day: "numeric", month: "short", year: "numeric" },
          locale
        ),
        campus,
      ]);
    case "job": {
      const deadline = formatSeconds(
        hit.deadline,
        { day: "numeric", month: "short" },
        locale
      );
      return joinMeta([
        deadline ? t("meta.applyBy", { date: deadline }) : null,
        hit.department ?? campus,
      ]);
    }
    case "product":
      return productMeta(hit, locale, t);
    case "page": {
      // A document's URL is its download route, which says nothing useful.
      if (hit.type === "document") {
        return joinMeta([hit.department, campus]);
      }
      return pageParents(hit.url) || (campus ?? "");
    }
    default:
      return hit.campus_name;
  }
}

/** Events lead with their date, news and products with their picture; nothing else gets a lead visual. */
export function leadOf(hit: SearchHit): LeadKind {
  if (hit.group === "event" && hit.starts_at !== null) {
    return "date";
  }
  const pictured =
    hit.group === "event" || hit.group === "news" || hit.group === "product";
  return pictured && hit.image ? "image" : null;
}
