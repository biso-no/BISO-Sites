import {
  isoToOsloWallClock,
  osloWallClockToIso,
} from "@repo/shared/utils/oslo-time";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

const DAY_FORMAT = "d. MMM yyyy";
const OSLO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** A stored instant → the Oslo date (`YYYY-MM-DD`) and time (`HH:mm`) for the form inputs. */
export function splitOsloDateTime(iso: string | null | undefined): {
  date: string;
  time: string;
} {
  const [date = "", time = ""] = isoToOsloWallClock(iso).split("T");
  return { date, time };
}

/** The form's Oslo date and time → a UTC ISO instant, or `""` when either is missing. */
export function joinOsloDateTime(date: string, time: string): string {
  if (!(date && time)) {
    return "";
  }
  return osloWallClockToIso(`${date}T${time}`) ?? "";
}

function formatOsloDay(iso: string, locale: string): string | null {
  const match = OSLO_DAY.exec(isoToOsloWallClock(iso));
  if (!match) {
    return null;
  }
  const [, year, month, day] = match.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  // Built from the Oslo calendar day, so the server's own zone can't shift it.
  return format(new Date(year, month - 1, day), DAY_FORMAT, {
    locale: locale === "no" ? nb : undefined,
  });
}

/** `24. jan. 2027 – 27. jan. 2027`, or a single day when both fall on it. */
export function formatBigEventDates(
  startsAt: string,
  endsAt: string,
  locale: string
): string {
  const start = formatOsloDay(startsAt, locale);
  const end = formatOsloDay(endsAt, locale);
  if (!(start && end) || start === end) {
    return start ?? end ?? "";
  }
  return `${start} – ${end}`;
}
