import { formatOsloDate } from "@repo/shared/utils/oslo-time";
import { htmlToPlainText } from "@repo/shared/utils/push-dispatch";
import { CAMPUS_ID_TO_NAME, CAMPUS_NAME_TO_ID } from "@/lib/campus-constants";

export type ComposerContentType = "event" | "news" | "job";

export interface LinkableItem {
  campusId: string | null;
  campusName: string;
  date: string | null;
  dateLabel: string;
  id: string;
  image: string | null;
  linkable: boolean;
  status: "published" | "draft";
  title: string;
  type: ComposerContentType;
}

export interface PersonResult {
  campusName: string;
  email: string;
  id: string;
  name: string;
}

interface TranslationLike {
  description?: string | null;
  locale?: string | null;
  short_description?: string | null;
  title?: string | null;
}

const NATIONAL_CAMPUS_ID = CAMPUS_NAME_TO_ID.National as string;
const PREFILL_MAX = 300;
const LOCALE = "en-GB";
const DAY_LABEL = { weekday: "short", day: "numeric", month: "short" } as const;
const DEADLINE_LABEL = { day: "numeric", month: "short" } as const;
const TOPIC_NAMES: Record<string, string> = {
  news: "News",
  events: "Events",
  jobs: "Jobs",
  shop: "Shop",
};

export function campusNameFor(campusId: string | null | undefined): string {
  if (!campusId) {
    return "";
  }
  return CAMPUS_ID_TO_NAME[campusId] ?? "";
}

function asTranslations(value: unknown): TranslationLike[] {
  return Array.isArray(value)
    ? value.filter(
        (row): row is TranslationLike => typeof row === "object" && row !== null
      )
    : [];
}

function translationFor(
  value: unknown,
  locale: "en" | "no"
): TranslationLike | undefined {
  return asTranslations(value).find((row) => row.locale === locale);
}

/** English title, else Norwegian, else the fallback. */
export function pickEnglishFirstTitle(
  translations: unknown,
  fallback: string
): string {
  return (
    translationFor(translations, "en")?.title ||
    translationFor(translations, "no")?.title ||
    asTranslations(translations).find((row) => row.title)?.title ||
    fallback
  );
}

function contentDate(
  type: ComposerContentType,
  row: Record<string, unknown>
): string | null {
  const key =
    type === "event"
      ? "start_date"
      : type === "news"
        ? "$createdAt"
        : "application_deadline";
  const value = row[key];
  return typeof value === "string" && value ? value : null;
}

export function dateLabelFor(
  type: ComposerContentType,
  date: string | null
): string {
  if (!date) {
    return "";
  }
  if (type === "job") {
    const label = formatOsloDate(date, DEADLINE_LABEL, LOCALE);
    return label ? `Apply by ${label}` : "";
  }
  return formatOsloDate(date, DAY_LABEL, LOCALE) ?? "";
}

export function toLinkableItem(
  type: ComposerContentType,
  row: Record<string, unknown>
): LinkableItem {
  const translations = type === "job" ? row.translations : row.translation_refs;
  const date = contentDate(type, row);
  const campusId =
    typeof row.campus_id === "string" && row.campus_id ? row.campus_id : null;
  const status = row.status === "published" ? "published" : "draft";
  return {
    id: String(row.$id),
    type,
    title: pickEnglishFirstTitle(translations, String(row.$id)),
    date,
    dateLabel: dateLabelFor(type, date),
    campusId,
    campusName: campusNameFor(campusId),
    image:
      type !== "job" && typeof row.image === "string" && row.image
        ? row.image
        : null,
    status,
    linkable: status === "published",
  };
}

export function toPersonResult(row: Record<string, unknown>): PersonResult {
  const campusId = typeof row.campus_id === "string" ? row.campus_id : null;
  return {
    id: String(row.$id),
    name: typeof row.name === "string" ? row.name : "",
    email: typeof row.email === "string" ? row.email : "",
    campusName: campusNameFor(campusId),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** The short description, else the plain-text description cut to 300 chars. */
export function prefillBody(translation: TranslationLike | undefined): string {
  const short = translation?.short_description?.trim();
  const text =
    short || htmlToPlainText(translation?.description).slice(0, PREFILL_MAX);
  const trimmed = text.trim();
  return trimmed ? `<p>${escapeHtml(trimmed)}</p>` : "";
}

export function toPrefill(
  type: ComposerContentType,
  row: Record<string, unknown>
) {
  const translations = type === "job" ? row.translations : row.translation_refs;
  const en = translationFor(translations, "en");
  const no = translationFor(translations, "no");
  const item = toLinkableItem(type, row);
  const topics = { event: "events", news: "news", job: "jobs" } as const;
  return {
    title_en: en?.title ?? "",
    title_no: no?.title ?? "",
    body_en: prefillBody(en),
    body_no: prefillBody(no),
    topic: topics[type],
    campusId: item.campusId,
    item,
    label: item.dateLabel ? `${item.title} (${item.dateLabel})` : item.title,
  };
}

export interface ReachSentenceInput {
  audienceType: string;
  audienceValue: string | null;
  campusId: string | null;
  count: number | null;
  groupName?: string | null;
}

export const REACH_UNAVAILABLE = "Reach unavailable right now";

/** The descriptive part of the reach line; the UI prefixes "About {n} phones". */
export function reachSentence(input: ReachSentenceInput): string {
  const { audienceType, audienceValue, campusId, count, groupName } = input;
  if (audienceType === "users") {
    return count === null ? REACH_UNAVAILABLE : `${count} people`;
  }
  if (audienceType === "segment") {
    if (count === null) {
      return REACH_UNAVAILABLE;
    }
    return groupName ? `${count} people in ${groupName}` : `${count} people`;
  }
  if (count === null) {
    return REACH_UNAVAILABLE;
  }
  const campus = campusNameFor(campusId);
  const isNational = !campusId || campusId === NATIONAL_CAMPUS_ID || !campus;
  if (audienceType === "broadcast") {
    return isNational ? "Everyone, at all campuses." : `Everyone at ${campus}.`;
  }
  const topic = TOPIC_NAMES[audienceValue ?? ""] ?? audienceValue ?? "";
  return isNational
    ? `Students who follow ${topic}, at all campuses.`
    : `${campus} students who follow ${topic}.`;
}
