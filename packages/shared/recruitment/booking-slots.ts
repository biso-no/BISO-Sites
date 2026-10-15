/**
 * Interview slots a candidate may pick, in BISO's office hours.
 *
 * Office hours are evaluated in Europe/Oslo whatever zone the server runs
 * in: the previous implementation used the server's local clock, which is
 * UTC in production, so "09:00" meant 11:00 for everyone involved.
 */

export interface BusyInterval {
  end: string;
  start: string;
}

export interface AvailableSlotsInput {
  busy: BusyInterval[];
  durationMinutes: number;
  from: Date;
  /** Minutes between slot starts. Default 30. */
  stepMinutes?: number;
  timeZone?: string;
  to: Date;
}

const MS_PER_MINUTE = 60_000;
const DEFAULT_STEP_MINUTES = 30;
const OFFICE_OPENS_MINUTES = 9 * 60;
const OFFICE_CLOSES_MINUTES = 17 * 60;
const WEEKEND = new Set(["Sat", "Sun"]);

interface LocalClock {
  day: string;
  minutesOfDay: number;
  weekday: string;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function localClock(date: Date, timeZone: string): LocalClock {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      timeZone,
      weekday: "short",
      year: "numeric",
    });
    formatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  // "24" shows up for midnight in some engines.
  const hour = Number(parts.hour) % 24;
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutesOfDay: hour * 60 + Number(parts.minute),
    weekday: parts.weekday,
  };
}

function overlapsBusy(start: Date, end: Date, busy: BusyInterval[]): boolean {
  return busy.some(
    (interval) =>
      start.getTime() < new Date(interval.end).getTime() &&
      new Date(interval.start).getTime() < end.getTime()
  );
}

export function availableSlots(input: AvailableSlotsInput): Date[] {
  const step = (input.stepMinutes ?? DEFAULT_STEP_MINUTES) * MS_PER_MINUTE;
  const duration = input.durationMinutes * MS_PER_MINUTE;
  const timeZone = input.timeZone ?? "Europe/Oslo";
  const slots: Date[] = [];

  // Align the first candidate to the step so slots land on round times.
  let cursor = Math.ceil(input.from.getTime() / step) * step;
  const last = input.to.getTime() - duration;
  while (cursor <= last) {
    const start = new Date(cursor);
    const end = new Date(cursor + duration);
    const opens = localClock(start, timeZone);
    const closes = localClock(end, timeZone);
    const inOfficeHours =
      !WEEKEND.has(opens.weekday) &&
      opens.day === closes.day &&
      opens.minutesOfDay >= OFFICE_OPENS_MINUTES &&
      closes.minutesOfDay <= OFFICE_CLOSES_MINUTES;
    if (inOfficeHours && !overlapsBusy(start, end, input.busy)) {
      slots.push(start);
    }
    cursor += step;
  }
  return slots;
}
