import type { Client as GraphClient } from "@microsoft/microsoft-graph-client";

/**
 * Microsoft Graph calendar / Outlook / Teams helpers used by the BISO
 * recruitment scheduler.
 *
 * Required Azure AD app permissions (admin-consented, application-only):
 *  - Calendars.Read.Shared     (read panelists' free/busy)
 *  - Calendars.ReadWrite       (create/cancel Outlook events on the organiser)
 *  - OnlineMeetings.ReadWrite.All (provision Teams meetings)
 *  - User.Read.All             (resolve userPrincipalName → display name)
 *
 * The functions degrade gracefully when the app lacks permissions: free/busy
 * lookups return "unknown" slots, Teams meeting creation returns null, and
 * callers fall back to manual scheduling.
 */

export interface BusyInterval {
  start: string;
  end: string;
  status?: string;
}

export interface FreeBusyResult {
  user: string;
  busy: BusyInterval[];
  workingHours?: WorkingHours;
  error?: string;
}

export interface WorkingHours {
  startTime: string; // "09:00:00.0000000"
  endTime: string; // "17:00:00.0000000"
  daysOfWeek: string[]; // ["monday", ...]
  timeZone: string;
}

export interface FreeSlotCandidate {
  start: Date;
  end: Date;
  conflictsByUser: Map<string, BusyInterval[]>;
}

const MS_PER_MINUTE = 60_000;

interface GetScheduleResponse {
  value?: Array<{
    scheduleId?: string;
    availabilityView?: string;
    scheduleItems?: Array<{
      status?: string;
      start?: { dateTime?: string; timeZone?: string };
      end?: { dateTime?: string; timeZone?: string };
    }>;
    workingHours?: WorkingHours;
    error?: { message?: string };
  }>;
}

/**
 * Look up free/busy for one or more users in a window.
 *
 * Uses Microsoft Graph's POST /users/{organizer}/calendar/getSchedule. The
 * organiser is just the calendar that "asks" — Graph still returns each
 * user's own busy intervals. We use the first UPN as the organiser by default.
 *
 * Returns one FreeBusyResult per requested user. When the call fails (lack of
 * consent, throttling, etc.) the failure is captured per-user with an empty
 * busy list so the slot-finder can fall back to "unknown" availability.
 */
export async function getFreeBusy(
  graph: GraphClient,
  userPrincipalNames: string[],
  window: { from: Date; to: Date },
  options: { slotMinutes?: number; organizer?: string } = {}
): Promise<FreeBusyResult[]> {
  if (userPrincipalNames.length === 0) {
    return [];
  }
  const organizer = options.organizer ?? userPrincipalNames[0];
  const slotMinutes = options.slotMinutes ?? 30;

  try {
    const response = (await graph
      .api(`/users/${encodeURIComponent(organizer)}/calendar/getSchedule`)
      .post({
        availabilityViewInterval: slotMinutes,
        endTime: {
          dateTime: window.to.toISOString(),
          timeZone: "UTC",
        },
        schedules: userPrincipalNames,
        startTime: {
          dateTime: window.from.toISOString(),
          timeZone: "UTC",
        },
      })) as GetScheduleResponse;

    const results: FreeBusyResult[] = userPrincipalNames.map((name, index) => {
      const entry = response.value?.[index];
      const items = entry?.scheduleItems ?? [];
      return {
        busy: items
          .filter(
            (item) =>
              item.status === "busy" ||
              item.status === "tentative" ||
              item.status === "oof"
          )
          .map((item) => ({
            end: item.end?.dateTime ?? window.to.toISOString(),
            start: item.start?.dateTime ?? window.from.toISOString(),
            status: item.status,
          })),
        error: entry?.error?.message,
        user: name,
        workingHours: entry?.workingHours,
      };
    });

    return results;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return userPrincipalNames.map((name) => ({
      busy: [],
      error: `getSchedule failed: ${message}`,
      user: name,
    }));
  }
}

/**
 * Compute common free-slot candidates inside the window, taking into account
 * each participant's busy intervals and (optionally) their working hours.
 *
 * Pure function — no Graph calls. Useful in tests and for offline ranking.
 */
export function findCommonSlots(
  freeBusyByUser: FreeBusyResult[],
  window: { from: Date; to: Date },
  options: {
    durationMinutes: number;
    stepMinutes?: number;
    workingHoursOnly?: boolean;
  }
): FreeSlotCandidate[] {
  const step = (options.stepMinutes ?? 15) * MS_PER_MINUTE;
  const durationMs = options.durationMinutes * MS_PER_MINUTE;
  const candidates: FreeSlotCandidate[] = [];

  for (
    let cursor = window.from.getTime();
    cursor + durationMs <= window.to.getTime();
    cursor += step
  ) {
    const start = new Date(cursor);
    const end = new Date(cursor + durationMs);

    if (options.workingHoursOnly && !isWithinAnyWorkingHours(start, end, freeBusyByUser)) {
      continue;
    }

    const conflicts = new Map<string, BusyInterval[]>();
    for (const entry of freeBusyByUser) {
      const overlaps = entry.busy.filter((interval) =>
        intervalsOverlap(
          start.toISOString(),
          end.toISOString(),
          interval.start,
          interval.end
        )
      );
      if (overlaps.length > 0) {
        conflicts.set(entry.user, overlaps);
      }
    }

    if (conflicts.size === 0) {
      candidates.push({ conflictsByUser: conflicts, end, start });
    }
  }

  return candidates;
}

function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return (
    new Date(aStart).getTime() < new Date(bEnd).getTime() &&
    new Date(bStart).getTime() < new Date(aEnd).getTime()
  );
}

function isWithinAnyWorkingHours(
  start: Date,
  end: Date,
  entries: FreeBusyResult[]
): boolean {
  for (const entry of entries) {
    const wh = entry.workingHours;
    if (!wh) {
      continue;
    }
    const dayName = start
      .toLocaleDateString("en-US", { weekday: "long" })
      .toLowerCase();
    if (!wh.daysOfWeek.includes(dayName)) {
      continue;
    }
    const [startHour, startMin] = wh.startTime.split(":").map(Number);
    const [endHour, endMin] = wh.endTime.split(":").map(Number);
    const winStart = new Date(start);
    winStart.setHours(startHour, startMin, 0, 0);
    const winEnd = new Date(start);
    winEnd.setHours(endHour, endMin, 0, 0);
    if (start.getTime() >= winStart.getTime() && end.getTime() <= winEnd.getTime()) {
      return true;
    }
  }
  // When no working-hours data is available, allow anything.
  return entries.every((entry) => entry.workingHours == null);
}

export interface CreateTeamsMeetingInput {
  subject: string;
  starts_at: Date;
  ends_at: Date;
  attendeeEmails?: string[];
}

export interface TeamsMeeting {
  id: string;
  joinUrl: string;
  conferenceId?: string;
}

/**
 * Provision a Teams meeting on behalf of the organiser. Returns null when the
 * app-token doesn't carry OnlineMeetings.ReadWrite.All so callers can fall
 * back to manual meeting URL entry.
 */
export async function createTeamsMeeting(
  graph: GraphClient,
  organizerUpn: string,
  input: CreateTeamsMeetingInput
): Promise<TeamsMeeting | null> {
  try {
    const response = (await graph
      .api(`/users/${encodeURIComponent(organizerUpn)}/onlineMeetings`)
      .post({
        endDateTime: input.ends_at.toISOString(),
        startDateTime: input.starts_at.toISOString(),
        subject: input.subject,
      })) as {
      id?: string;
      joinUrl?: string;
      videoTeleconferenceId?: string;
    };

    if (!(response.id && response.joinUrl)) {
      return null;
    }
    return {
      conferenceId: response.videoTeleconferenceId,
      id: response.id,
      joinUrl: response.joinUrl,
    };
  } catch (error) {
    console.warn("createTeamsMeeting failed", error);
    return null;
  }
}

export interface CalendarEventInput {
  subject: string;
  body: string;
  starts_at: Date;
  ends_at: Date;
  attendeeEmails: string[];
  location?: string | null;
  onlineMeetingUrl?: string | null;
  timezone?: string;
}

export interface CalendarEvent {
  id: string;
  webLink?: string;
}

/**
 * Create an Outlook calendar event on the organiser's calendar with the
 * candidate + panel as attendees. Returns null on failure so the scheduler
 * can still record the interview internally and surface a manual fallback.
 */
export async function createCalendarEvent(
  graph: GraphClient,
  organizerUpn: string,
  input: CalendarEventInput
): Promise<CalendarEvent | null> {
  try {
    const response = (await graph
      .api(`/users/${encodeURIComponent(organizerUpn)}/events`)
      .post({
        attendees: input.attendeeEmails.map((email) => ({
          emailAddress: { address: email },
          type: "required",
        })),
        body: {
          content: input.body,
          contentType: "html",
        },
        end: {
          dateTime: input.ends_at.toISOString(),
          timeZone: input.timezone ?? "UTC",
        },
        isOnlineMeeting: Boolean(input.onlineMeetingUrl),
        location: input.location
          ? { displayName: input.location }
          : undefined,
        start: {
          dateTime: input.starts_at.toISOString(),
          timeZone: input.timezone ?? "UTC",
        },
        subject: input.subject,
      })) as { id?: string; webLink?: string };

    if (!response.id) {
      return null;
    }
    return { id: response.id, webLink: response.webLink };
  } catch (error) {
    console.warn("createCalendarEvent failed", error);
    return null;
  }
}

export async function cancelCalendarEvent(
  graph: GraphClient,
  organizerUpn: string,
  eventId: string,
  reason?: string
): Promise<{ ok: boolean }> {
  try {
    await graph
      .api(
        `/users/${encodeURIComponent(organizerUpn)}/events/${eventId}/cancel`
      )
      .post({ comment: reason ?? "Interview cancelled." });
    return { ok: true };
  } catch (error) {
    console.warn("cancelCalendarEvent failed", error);
    return { ok: false };
  }
}
