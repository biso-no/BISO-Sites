import { toPlainText, truncateAtWord } from "../../utils/content-text";
import {
  OPEN_ENDED,
  type SearchEntry,
  type SearchLocale,
  type SearchType,
  searchEntryId,
} from "../types";

export interface TranslationText {
  additional_fields?: string | null;
  description: string | null;
  locale: SearchLocale;
  short_description: string | null;
  title: string;
}

export interface MapContext {
  departmentName: (id: string | null | undefined) => string | null;
  now: Date;
  /** Unix ms of this sync run. */
  syncedAt: number;
}

const SUMMARY_MAX = 200;
const BODY_MAX = 4000;

/** The translation for `locale`, else the other one, else null. */
export function textFor(
  translations: TranslationText[],
  locale: SearchLocale
): TranslationText | null {
  return (
    translations.find((t) => t.locale === locale) ?? translations[0] ?? null
  );
}

export function summaryOf(t: TranslationText): string {
  const short = toPlainText(t.short_description);
  if (short) {
    return short;
  }
  return truncateAtWord(toPlainText(t.description), SUMMARY_MAX);
}

export function bodyOf(t: TranslationText): string {
  return truncateAtWord(toPlainText(t.description), BODY_MAX);
}

/** Tags arrive as an array or a comma-separated string. */
export function keywordsOf(
  tags: string[] | string | null | undefined
): string[] {
  if (!tags) {
    return [];
  }
  const list = Array.isArray(tags) ? tags : tags.split(",");
  return list.map((tag) => tag.trim()).filter(Boolean);
}

export function nonEmpty(value: string | null | undefined): string | null {
  return value ? value : null;
}

interface BaseInput {
  campusId: string;
  locale: SearchLocale;
  rowId: string;
  textLocale: SearchLocale;
  type: SearchType;
  url: string;
}

/** The fields every entry shares, with every optional field defaulted. */
export function baseEntry(
  input: BaseInput,
  ctx: Pick<MapContext, "syncedAt">
): SearchEntry {
  return {
    id: searchEntryId(input.type, input.rowId, input.locale),
    type: input.type,
    row_id: input.rowId,
    locale: input.locale,
    text_locale: input.textLocale,
    campus_id: input.campusId,
    url: input.url,
    synced_at: ctx.syncedAt,
    title: "",
    summary: "",
    body: "",
    keywords: [],
    category: null,
    cover_pattern: null,
    deadline: null,
    department: null,
    ends_at: null,
    image: null,
    in_stock: null,
    location: null,
    member_only: false,
    member_price: null,
    price: null,
    published_at: null,
    starts_at: null,
    visible_until: OPEN_ENDED,
  };
}

/** Title/summary/body of one translation, as entry fields. */
export function textFields(
  t: TranslationText
): Pick<SearchEntry, "title" | "summary" | "body"> {
  return {
    title: toPlainText(t.title),
    summary: summaryOf(t),
    body: bodyOf(t),
  };
}
