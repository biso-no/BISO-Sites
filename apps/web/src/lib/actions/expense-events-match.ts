"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { type Events, EventsStatus } from "@repo/api/types/appwrite";
import { getLocale } from "@/app/actions/locale";
import {
  eventSearchWindows,
  MAX_EVENT_SUGGESTIONS,
  nearestEvents,
  receiptDateList,
} from "@/lib/expense-event-window";

export interface NearbyEvent {
  id: string;
  startDate: string;
  title: string;
}

/** Matches the `department_id` column's size. */
const DEPARTMENT_ID_MAX = 50;
/** Rows read per lookup; the matching windows keep the set small. */
const ROW_LIMIT = 100;

/** The title in the visitor's language, else whichever translation exists. */
function eventTitle(event: Events, locale: string): string | null {
  const refs = Array.isArray(event.translation_refs)
    ? event.translation_refs
    : [];
  const titled = refs.filter((ref) => ref?.title?.trim());
  const ref = titled.find((item) => item.locale === locale) ?? titled[0];
  return ref?.title.trim() ?? null;
}

/**
 * Published events of a department that start within seven days of any of
 * the receipt dates, nearest first, at most three — the composer's "Was this
 * for {event}?" suggestion. Events are public (`read("any")`); the status
 * filter is fixed here so a caller can never widen it to drafts or cancelled
 * events.
 */
export async function findNearbyDepartmentEvents(input: {
  departmentId: string;
  dates: string[];
}): Promise<{ success: boolean; data?: NearbyEvent[]; error?: string }> {
  const departmentId =
    typeof input?.departmentId === "string" ? input.departmentId.trim() : "";
  if (!departmentId || departmentId.length > DEPARTMENT_ID_MAX) {
    return { success: false, error: "A department is required" };
  }

  const dates = receiptDateList(Array.isArray(input.dates) ? input.dates : []);
  if (dates.length === 0) {
    return { success: true, data: [] };
  }

  const ranges = eventSearchWindows(dates).map(({ from, to }) =>
    Query.between("start_date", from, to)
  );

  try {
    const [{ db }, locale] = await Promise.all([
      createSessionClient(),
      getLocale(),
    ]);
    const { rows } = await db.listRows<Events>("app", "events", [
      Query.equal("department_id", departmentId),
      Query.equal("status", EventsStatus.PUBLISHED),
      ranges.length === 1 ? ranges[0] : Query.or(ranges),
      Query.orderAsc("start_date"),
      Query.select([
        "$id",
        "start_date",
        "translation_refs.locale",
        "translation_refs.title",
      ]),
      Query.limit(ROW_LIMIT),
    ]);

    const candidates = rows.flatMap((event) => {
      const title = eventTitle(event, locale);
      return event.start_date && title
        ? [{ id: event.$id, startDate: event.start_date, title }]
        : [];
    });

    return {
      success: true,
      data: nearestEvents(candidates, dates, MAX_EVENT_SUGGESTIONS),
    };
  } catch (error) {
    console.error("findNearbyDepartmentEvents failed:", error);
    return { success: false, error: "Could not look up events" };
  }
}
