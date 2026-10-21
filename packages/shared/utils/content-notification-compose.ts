import { channelFor, type NotifyContentType } from "./content-notifications";
import { campusSlugFor, NATIONAL_SLUG } from "./notification-topics";
import { formatOsloDate, formatOsloTime } from "./oslo-time";
import { htmlToPlainText } from "./push-dispatch";

/**
 * Builds the text and the announcement row for an automatic content
 * notification. Also imported by an Appwrite Function, so no `server-only`.
 */

export interface NotifyItem {
  campusId: string | null;
  channel: string;
  date: string | null;
  descriptionEn: string | null;
  descriptionNo: string | null;
  id: string;
  image: string | null;
  location: string | null;
  /** Last-resort title when neither language has one. */
  slug: string | null;
  summaryEn: string | null;
  summaryNo: string | null;
  titleEn: string | null;
  titleNo: string | null;
  type: NotifyContentType;
}

export interface AutoAnnouncementColumns {
  audience_type: "topic";
  audience_value: string;
  body_en: string;
  body_no: string;
  campus: string | null;
  campus_id: string | null;
  category: string;
  content_id: string | null;
  content_ids: string[] | null;
  content_type: NotifyContentType;
  deep_link: null;
  image: string | null;
  items: string;
  push: true;
  sent_at: string;
  source: "auto";
  status: "sent";
  title_en: string;
  title_no: string;
}

type Lang = "en" | "no";
interface Translation {
  description?: string | null;
  locale: string;
  short_description?: string | null;
  title?: string | null;
}

const LEADING_DAY = /^(\d+)/;
const MAX_TITLE = 200;
const MAX_BODY = 500;
const NEWS_EXCERPT = 140;
const GROUP_TITLES_SHOWN = 3;
const SEPARATOR = " · ";
const LOCALE: Record<Lang, string> = { en: "en-GB", no: "nb-NO" };
const SHORT_DATE = {
  weekday: "short",
  day: "numeric",
  month: "short",
} as const;
const DAY_MONTH_LONG = { day: "numeric", month: "long" } as const;

const CAMPUS_NAMES: Record<string, string> = {
  oslo: "Oslo",
  bergen: "Bergen",
  trondheim: "Trondheim",
  stavanger: "Stavanger",
};

const GROUP_NOUN: Record<NotifyContentType, Record<Lang, string>> = {
  event: { en: "new events", no: "nye arrangementer" },
  news: { en: "new news stories", no: "nye nyheter" },
  job: { en: "new positions", no: "nye stillinger" },
};

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function toNotifyItem(
  type: NotifyContentType,
  row: Record<string, unknown>,
  translations: Translation[]
): NotifyItem {
  const en = translations.find((t) => t.locale === "en");
  const no = translations.find((t) => t.locale === "no");
  const campusId = str(row.campus_id);
  let date: string | null = null;
  if (type === "event") {
    date = str(row.start_date);
  } else if (type === "news") {
    date = str(row.$createdAt);
  } else {
    date = str(row.application_deadline);
  }
  return {
    type,
    id: String(row.$id),
    campusId,
    channel: channelFor(type, campusId),
    titleEn: str(en?.title),
    titleNo: str(no?.title),
    summaryEn: str(en?.short_description),
    summaryNo: str(no?.short_description),
    descriptionEn: str(en?.description),
    descriptionNo: str(no?.description),
    date,
    location: type === "event" ? str(row.location) : null,
    image: type === "job" ? null : str(row.image),
    slug: str(row.slug),
  };
}

function cut(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function titleOf(item: NotifyItem, lang: Lang): string {
  const own = lang === "en" ? item.titleEn : item.titleNo;
  const other = lang === "en" ? item.titleNo : item.titleEn;
  return own ?? other ?? item.slug ?? "";
}

/**
 * Whether the item has something to show as its title: a translation in
 * either language, else its slug. Leave untitled items out of a send.
 */
export function hasNotifyTitle(item: NotifyItem): boolean {
  return titleOf(item, "en") !== "";
}

function summaryOf(item: NotifyItem, lang: Lang): string {
  const own = lang === "en" ? item.summaryEn : item.summaryNo;
  const other = lang === "en" ? item.summaryNo : item.summaryEn;
  return own ?? other ?? "";
}

function descriptionOf(item: NotifyItem, lang: Lang): string {
  const own = lang === "en" ? item.descriptionEn : item.descriptionNo;
  const other = lang === "en" ? item.descriptionNo : item.descriptionEn;
  return own ?? other ?? "";
}

function singleBody(item: NotifyItem, lang: Lang): string {
  const locale = LOCALE[lang];
  if (item.type === "event") {
    const day = formatOsloDate(item.date, SHORT_DATE, locale);
    const time = formatOsloTime(item.date);
    const parts = [day && time ? `${day}${SEPARATOR}${time}` : (day ?? time)];
    if (item.location) {
      parts.push(item.location);
    }
    return parts.filter(Boolean).join(SEPARATOR);
  }
  if (item.type === "job") {
    const deadline = formatOsloDate(item.date, DAY_MONTH_LONG, locale);
    if (deadline) {
      return lang === "en"
        ? `Apply by ${deadline}`
        : `Søknadsfrist ${deadline.includes(".") ? deadline : deadline.replace(LEADING_DAY, "$1.")}`;
    }
    return summaryOf(item, lang);
  }
  const summary = summaryOf(item, lang);
  if (summary) {
    return summary;
  }
  const plain = htmlToPlainText(descriptionOf(item, lang));
  return plain.length > NEWS_EXCERPT
    ? `${plain.slice(0, NEWS_EXCERPT)}…`
    : plain;
}

function singleTitle(item: NotifyItem, lang: Lang): string {
  const title = titleOf(item, lang);
  if (item.type !== "job") {
    return title;
  }
  return lang === "en" ? `New position: ${title}` : `Ny stilling: ${title}`;
}

function groupTitle(items: NotifyItem[], lang: Lang): string {
  const [first] = items;
  const slug = campusSlugFor(first?.campusId);
  const noun = GROUP_NOUN[first?.type ?? "event"][lang];
  const count = items.length;
  if (slug === NATIONAL_SLUG) {
    return `${count} ${noun} ${lang === "en" ? "from BISO" : "fra BISO"}`;
  }
  const campus = CAMPUS_NAMES[slug] ?? slug;
  return `${count} ${noun} ${lang === "en" ? "in" : "i"} ${campus}`;
}

function groupBody(items: NotifyItem[], lang: Lang): string {
  const titles = items
    .slice(0, GROUP_TITLES_SHOWN)
    .map((i) => titleOf(i, lang))
    .join(SEPARATOR);
  return items.length > GROUP_TITLES_SHOWN ? `${titles} …` : titles;
}

export function composeAutoAnnouncement(
  items: NotifyItem[],
  now: Date
): AutoAnnouncementColumns {
  const [first] = items;
  if (!first) {
    throw new Error("composeAutoAnnouncement needs at least one item");
  }
  const single = items.length === 1;
  const title = (lang: Lang) =>
    cut(single ? singleTitle(first, lang) : groupTitle(items, lang), MAX_TITLE);
  const body = (lang: Lang) =>
    cut(single ? singleBody(first, lang) : groupBody(items, lang), MAX_BODY);

  return {
    category: first.type,
    source: "auto",
    status: "sent",
    push: true,
    audience_type: "topic",
    audience_value: first.channel,
    campus: first.campusId,
    campus_id: first.campusId,
    content_type: first.type,
    content_id: single ? first.id : null,
    content_ids: single ? null : items.map((i) => i.id),
    items: JSON.stringify(
      items.map((i) => ({
        type: i.type,
        id: i.id,
        title_en: titleOf(i, "en"),
        title_no: titleOf(i, "no"),
        image: i.image,
        date: i.date,
        campus_id: i.campusId,
      }))
    ),
    image: first.image,
    title_en: title("en"),
    title_no: title("no"),
    body_en: body("en"),
    body_no: body("no"),
    sent_at: now.toISOString(),
    deep_link: null,
  };
}
