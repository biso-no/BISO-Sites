import {
  campusSlugFor,
  GENERAL_TOPIC_ID,
  isNotificationTopic,
  logicalTopicFor,
  NOTIFICATION_TOPICS,
  type NotificationTopic,
} from "@repo/shared/utils/notification-topics";
import { CAMPUS_ID_TO_NAME, CAMPUS_NAME_TO_ID } from "@/lib/campus-constants";

/**
 * How audiences read in the admin: campus names and channel slugs, topic
 * names and the people/phone counts. The one source for the composer, its
 * server lookups and the history list. Client-safe on purpose: it imports
 * neither the Appwrite SDK nor `node:crypto`.
 */

export const NATIONAL_CAMPUS_ID = CAMPUS_NAME_TO_ID.National as string;

const ALL_CAMPUS_IDS = Object.values(CAMPUS_NAME_TO_ID);

/** The campuses an audience can be limited to, in pill order (not National). */
export const CAMPUS_IDS: readonly string[] = ALL_CAMPUS_IDS.filter(
  (id) => id !== NATIONAL_CAMPUS_ID
);

/** No campus, or National: the audience is every campus. */
export function isNationalOrUnset(
  campusId: string | null | undefined
): boolean {
  return !campusId || campusId === NATIONAL_CAMPUS_ID;
}

/** "Bergen" for "2"; empty for no campus or an unknown one. */
export function campusNameFor(campusId: string | null | undefined): string {
  return campusId ? (CAMPUS_ID_TO_NAME[campusId] ?? "") : "";
}

/** "2" for "Bergen"; null for an unknown name. */
export function campusIdForName(
  name: string | null | undefined
): string | null {
  return name ? (CAMPUS_NAME_TO_ID[name] ?? null) : null;
}

/** The campus a channel slug names ("bergen" is "2"), or undefined. */
export function campusIdForSlug(slug: string): string | undefined {
  return ALL_CAMPUS_IDS.find((id) => campusSlugFor(id) === slug);
}

export const TOPIC_NAMES: Record<NotificationTopic, string> = {
  events: "Events",
  jobs: "Jobs",
  news: "News",
  shop: "Shop",
};

/** The topics a student can follow, in pill order. */
export const TOPIC_OPTIONS = NOTIFICATION_TOPICS.map((value) => ({
  label: TOPIC_NAMES[value],
  value,
}));

const LANGUAGE_SUFFIX = /_(?:no|en)$/;
/** The retired name for Shop, bare or as a channel ("products_oslo"). */
const LEGACY_SHOP_PREFIX = /^products(?=_|$)/;

function capitalize(word: string): string {
  return word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word;
}

function channelTopic(normalized: string): string {
  if (
    normalized === GENERAL_TOPIC_ID ||
    normalized.startsWith(`${GENERAL_TOPIC_ID}_`)
  ) {
    return GENERAL_TOPIC_ID;
  }
  return logicalTopicFor(normalized);
}

/**
 * A stored audience value as its topic and the campus its channel names:
 * "events_oslo_no" is Events at Oslo, "general_bergen" is everyone at Bergen,
 * "products" is Shop with no campus of its own.
 */
export function parseChannel(value: string | null | undefined): {
  campusId: string | undefined;
  topic: string;
} {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(LANGUAGE_SUFFIX, "")
    .replace(LEGACY_SHOP_PREFIX, "shop");
  const topic = channelTopic(normalized);
  const slug = normalized.startsWith(`${topic}_`)
    ? normalized.slice(topic.length + 1)
    : "";
  return { campusId: slug ? campusIdForSlug(slug) : undefined, topic };
}

/** "Events" for "events", "events_oslo" or "events_oslo_no"; "Shop" for "products". */
export function topicNameFor(value: string | null | undefined): string {
  const { topic } = parseChannel(value);
  return isNotificationTopic(topic) ? TOPIC_NAMES[topic] : capitalize(topic);
}

/** "1 person", "3 people". */
export function peopleCount(count: number): string {
  return count === 1 ? "1 person" : `${count} people`;
}

/** "1 phone", "412 phones". */
export function phoneCount(count: number): string {
  return count === 1 ? "1 phone" : `${count} phones`;
}
