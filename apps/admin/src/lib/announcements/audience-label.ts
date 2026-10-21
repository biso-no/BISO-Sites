import {
  isNotificationTopic,
  logicalTopicFor,
} from "@repo/shared/utils/notification-topics";
import { parseAudiencePeople } from "./audience-people";

/** The stored fields a history row's audience label is derived from. */
export interface AudienceLabelRow {
  audience_type: string;
  audience_value?: string | null;
  campus_id?: string | null;
}

const NATIONAL_ID = "5";
const ALL_CAMPUSES = "all campuses";
const LANGUAGE_SUFFIX = /_(?:no|en)$/;
const GENERAL_PREFIX = /^general_?/;

const SLUG_TO_CAMPUS_ID: Record<string, string> = {
  bergen: "2",
  national: NATIONAL_ID,
  oslo: "1",
  stavanger: "4",
  trondheim: "3",
};

const TOPIC_NAMES: Record<string, string> = {
  events: "Events",
  jobs: "Jobs",
  news: "News",
  shop: "Shop",
};

function capitalize(word: string): string {
  return word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word;
}

function stripLanguage(value: string): string {
  return value.trim().toLowerCase().replace(LANGUAGE_SUFFIX, "");
}

/** The campus a stored channel suffix names ("bergen"), or undefined. */
function campusIdFromSlug(slug: string): string | undefined {
  return SLUG_TO_CAMPUS_ID[slug];
}

/** A campus id as a display name, or null when it means "all campuses". */
function campusLabel(
  campusId: string | null | undefined,
  campusNames: Record<string, string>
): string | null {
  if (!campusId || campusId === NATIONAL_ID) {
    return null;
  }
  return campusNames[campusId] ?? null;
}

function scopeLabel(
  campusId: string | null | undefined,
  campusNames: Record<string, string>
): string {
  return campusLabel(campusId, campusNames) ?? ALL_CAMPUSES;
}

function broadcastLabel(
  row: AudienceLabelRow,
  campusNames: Record<string, string>
): string {
  const value = stripLanguage(row.audience_value ?? "");
  const slug = value.replace(GENERAL_PREFIX, "");
  const channelCampus = slug ? campusIdFromSlug(slug) : undefined;
  const campusId = channelCampus ?? row.campus_id;
  const name = campusLabel(campusId, campusNames);
  return name ? `Everyone at ${name}` : "Everyone (all campuses)";
}

function topicLabel(
  row: AudienceLabelRow,
  campusNames: Record<string, string>
): string {
  const value = stripLanguage(row.audience_value ?? "");
  const logical = logicalTopicFor(value === "products" ? "shop" : value);
  const topic = isNotificationTopic(logical)
    ? TOPIC_NAMES[logical]
    : capitalize(logical);
  const remainder = value.startsWith(`${logical}_`)
    ? value.slice(logical.length + 1)
    : "";
  const channelCampus = remainder ? campusIdFromSlug(remainder) : undefined;
  return `${topic} · ${scopeLabel(channelCampus ?? row.campus_id, campusNames)}`;
}

/**
 * The plain-English audience of a stored announcement, for the history list.
 * `campusNames` maps campus id to name; `segmentName` is the group's name for
 * `segment` rows when it could be loaded.
 */
export function audienceLabel(
  row: AudienceLabelRow,
  campusNames: Record<string, string>,
  segmentName?: string | null
): string {
  switch (row.audience_type) {
    case "broadcast":
      return broadcastLabel(row, campusNames);
    case "topic":
      return topicLabel(row, campusNames);
    case "users":
      return `${parseAudiencePeople(row.audience_value).length} people`;
    case "segment":
      return segmentName ? `Group: ${segmentName}` : "Group";
    default:
      return capitalize(row.audience_type);
  }
}
