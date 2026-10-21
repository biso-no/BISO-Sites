import {
  campusNameFor,
  isNationalOrUnset,
  parseChannel,
  peopleCount,
  topicNameFor,
} from "./audience-names";
import { parseAudiencePeople } from "./audience-people";

/** The stored fields a history row's audience label is derived from. */
export interface AudienceLabelRow {
  audience_type: string;
  audience_value?: string | null;
  campus_id?: string | null;
}

const ALL_CAMPUSES = "all campuses";

function capitalize(word: string): string {
  return word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word;
}

/** A campus id as a display name, or null when it means "all campuses". */
function campusLabel(campusId: string | null | undefined): string | null {
  if (isNationalOrUnset(campusId)) {
    return null;
  }
  return campusNameFor(campusId) || null;
}

/**
 * The campus a row reaches: the one its stored channel names (sent rows hold
 * "events_oslo" or "general_bergen"), else its campus column.
 */
function rowCampus(row: AudienceLabelRow): string | null | undefined {
  return parseChannel(row.audience_value).campusId ?? row.campus_id;
}

function broadcastLabel(row: AudienceLabelRow): string {
  const name = campusLabel(rowCampus(row));
  return name ? `Everyone at ${name}` : "Everyone (all campuses)";
}

function topicLabel(row: AudienceLabelRow): string {
  const scope = campusLabel(rowCampus(row)) ?? ALL_CAMPUSES;
  return `${topicNameFor(row.audience_value)} · ${scope}`;
}

/**
 * The plain-English audience of a stored announcement, for the history list.
 * `segmentName` is the group's name for `segment` rows when it could be loaded.
 */
export function audienceLabel(
  row: AudienceLabelRow,
  segmentName?: string | null
): string {
  switch (row.audience_type) {
    case "broadcast":
      return broadcastLabel(row);
    case "topic":
      return topicLabel(row);
    case "users":
      return peopleCount(parseAudiencePeople(row.audience_value).length);
    case "segment":
      return segmentName ? `Group: ${segmentName}` : "Group";
    default:
      return capitalize(row.audience_type);
  }
}
