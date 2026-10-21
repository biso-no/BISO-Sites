import { createHash } from "node:crypto";
import { type NotificationTopic, topicIdFor } from "./notification-topics";
import { isoToOsloWallClock, osloWallClockToIso } from "./oslo-time";

/**
 * Shared rules for automatic content notifications. Also imported by an
 * Appwrite Function, so keep it free of `server-only`.
 */

export type NotifyContentType = "event" | "news" | "job";

export const NOTIFY_DEFAULT_DELAY_MINUTES = 3;
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 8;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const MAX_ROW_ID_LENGTH = 36;
const SAFE_ID_REGEX = /^[A-Za-z0-9._-]+$/;

const TABLE_FOR_TYPE = {
  event: "events",
  job: "jobs",
  news: "news",
} as const satisfies Record<NotifyContentType, string>;

const TOPIC_FOR_TYPE = {
  event: "events",
  job: "jobs",
  news: "news",
} as const satisfies Record<NotifyContentType, NotificationTopic>;

export function contentTableFor(
  type: NotifyContentType
): "events" | "news" | "jobs" {
  return TABLE_FOR_TYPE[type];
}

export function contentTypeForTable(table: string): NotifyContentType | null {
  for (const type of Object.keys(TABLE_FOR_TYPE) as NotifyContentType[]) {
    if (TABLE_FOR_TYPE[type] === table) {
      return type;
    }
  }
  return null;
}

/** Row id of the lock row for a piece of content; Appwrite ids max out at 36. */
export function lockRowIdFor(
  type: NotifyContentType,
  contentId: string
): string {
  const readable = `${type}_${contentId}`;
  if (readable.length <= MAX_ROW_ID_LENGTH && SAFE_ID_REGEX.test(contentId)) {
    return readable;
  }
  const hash = createHash("sha256").update(contentId).digest("hex");
  return `${type}_${hash.slice(0, MAX_ROW_ID_LENGTH - type.length - 1)}`;
}

export function channelFor(
  type: NotifyContentType,
  campusId: string | null | undefined
): string {
  return topicIdFor(TOPIC_FOR_TYPE[type], campusId);
}

export type Eligibility = { ok: true } | { ok: false; reason: string };

function isBefore(value: unknown, now: Date): boolean {
  if (typeof value !== "string" || !value) {
    return false;
  }
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && time < now.getTime();
}

export function eligibilityFor(
  type: NotifyContentType,
  row: Record<string, unknown>,
  now: Date
): Eligibility {
  if (row.status !== "published") {
    return { ok: false, reason: "not published" };
  }
  if (row.notify_push !== true) {
    return { ok: false, reason: "notify off" };
  }
  if (type === "event") {
    const end = row.end_date ?? row.start_date;
    if (isBefore(end, now)) {
      return { ok: false, reason: "event over" };
    }
  }
  if (type === "job" && isBefore(row.application_deadline, now)) {
    return { ok: false, reason: "deadline passed" };
  }
  return { ok: true };
}

function eightAmOslo(date: string): Date {
  const iso = osloWallClockToIso(
    `${date}T${String(NIGHT_END_HOUR).padStart(2, "0")}:00`
  );
  if (!iso) {
    throw new Error(`Invalid Oslo date: ${date}`);
  }
  return new Date(iso);
}

/** When a notification may go out: after the delay, never in the Oslo night. */
export function dueAtFor(input: {
  now: Date;
  scheduledPublishAt?: string | null;
  delayMinutes: number;
}): Date {
  let due = input.now.getTime() + input.delayMinutes * MS_PER_MINUTE;
  if (input.scheduledPublishAt) {
    const scheduled = new Date(input.scheduledPublishAt).getTime();
    if (!Number.isNaN(scheduled) && scheduled > due) {
      due = scheduled;
    }
  }

  const wallClock = isoToOsloWallClock(new Date(due).toISOString());
  const [date = "", time = ""] = wallClock.split("T");
  const hour = Number(time.slice(0, 2));

  if (hour >= NIGHT_START_HOUR) {
    const next = new Date(
      Date.UTC(
        Number(date.slice(0, 4)),
        Number(date.slice(5, 7)) - 1,
        Number(date.slice(8, 10))
      ) + MS_PER_DAY
    );
    return eightAmOslo(next.toISOString().slice(0, 10));
  }
  if (hour < NIGHT_END_HOUR) {
    return eightAmOslo(date);
  }
  return new Date(due);
}
