import {
  broadcastChannelFor,
  NOTIFICATION_TOPICS,
  type NotificationTopic,
  topicIdFor,
} from "@repo/shared/utils/notification-topics";
import type { AudienceContext } from "@/lib/announcements/audience-policy";
import { CAMPUS_NAME_TO_ID } from "@/lib/campus-constants";

const GLOBAL_ADMIN_ROLE = "globaladmin";
const CAMPUS_ADMIN_ROLE = "campusadmin";
const NATIONAL_CAMPUS_ID = CAMPUS_NAME_TO_ID.National as string;

/** The campuses that have their own channels, in sidebar order. */
const REAL_CAMPUS_IDS = Object.values(CAMPUS_NAME_TO_ID).filter(
  (id) => id !== NATIONAL_CAMPUS_ID
);

export type OverviewRowKey = "everyone" | NotificationTopic;

/** A column is a campus id, or `null` for "all campuses". */
export type OverviewColumn = string | null;

export interface OverviewRow {
  /**
   * One push channel per column, in column order. `null` hides the cell: the
   * viewer may not see that number.
   */
  channels: (string | null)[];
  key: OverviewRowKey;
}

export interface SubscriberOverviewGrid {
  columns: OverviewColumn[];
  rows: OverviewRow[];
}

const ROW_KEYS: readonly OverviewRowKey[] = [
  "everyone",
  ...NOTIFICATION_TOPICS,
];

/**
 * The channel a cell counts. "Everyone" maps to the broadcast channels
 * (`general_oslo`, or `general` for all campuses). A topic maps to its campus
 * channel, or to its national channel for all campuses: the app subscribes
 * everyone who turns a topic on to its national scope too, so `news_national`
 * is how many phones a national news push reaches.
 */
function channelFor(row: OverviewRowKey, column: OverviewColumn): string {
  if (row === "everyone") {
    return broadcastChannelFor(column);
  }
  return topicIdFor(row, column);
}

/**
 * Which subscriber counts the viewer may see, as a topic-by-campus grid.
 *
 * - Global admins see every campus and the all-campuses column.
 * - Campus admins see the campuses they manage, plus the all-campuses
 *   "Everyone" count (the `general` channel every device is on). The
 *   all-campuses cells of the topic rows are hidden.
 * - Anyone else sees nothing.
 */
export function subscriberOverviewGrid(
  ctx: AudienceContext
): SubscriberOverviewGrid {
  const isGlobalAdmin = ctx.roles.includes(GLOBAL_ADMIN_ROLE);
  if (!(isGlobalAdmin || ctx.roles.includes(CAMPUS_ADMIN_ROLE))) {
    return { columns: [], rows: [] };
  }

  const campusIds = isGlobalAdmin
    ? REAL_CAMPUS_IDS
    : REAL_CAMPUS_IDS.filter((id) => ctx.managedCampusIds.includes(id));
  const columns: OverviewColumn[] = [...campusIds, null];

  const rows = ROW_KEYS.map((key) => ({
    channels: columns.map((column) => {
      const visible = isGlobalAdmin || column !== null || key === "everyone";
      return visible ? channelFor(key, column) : null;
    }),
    key,
  }));
  return { columns, rows };
}

/** Every channel the grid shows, once each, for fetching the counts. */
export function overviewChannels(grid: SubscriberOverviewGrid): string[] {
  const channels = new Set<string>();
  for (const row of grid.rows) {
    for (const channel of row.channels) {
      if (channel) {
        channels.add(channel);
      }
    }
  }
  return [...channels];
}
