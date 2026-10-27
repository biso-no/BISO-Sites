import { OSLO_TIME_ZONE } from "@repo/shared/utils/oslo-time";
import { cn } from "@repo/ui/lib/utils";

const NON_DIGIT = /\D/g;

/**
 * The stacked month/day marker from the reference's events list — MAY over 22.
 *
 * Renders a real `<time>` with a machine-readable `dateTime`, so the date is
 * available to assistive technology and parsers rather than being three visual
 * fragments. The digits use the `data` type role, which is tabular, so a column
 * of dates aligns regardless of which digits appear.
 */
export interface DateBlockProps {
  className?: string;
  /** ISO date string or Date. */
  date: string | Date;
  locale?: string;
}

export function DateBlock({
  date,
  locale = "nb-NO",
  className,
}: DateBlockProps) {
  const value = typeof date === "string" ? new Date(date) : date;
  // Formatted in Oslo time. Content dates are stored as UTC instants and an
  // event's day is the day it happens in Norway (`@repo/shared/utils/oslo-time`),
  // so a UTC reading would print the previous day for anything starting
  // between midnight and 02:00 Oslo time. The `dateTime` attribute is the
  // same Oslo calendar date, so the machine-readable value agrees with the
  // printed one. `en-CA` formats as YYYY-MM-DD.
  const iso = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: OSLO_TIME_ZONE,
    year: "numeric",
  }).format(value);
  const month = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: OSLO_TIME_ZONE,
  })
    .format(value)
    .replace(".", "")
    .toUpperCase();
  // Norwegian ordinals render as "22." — strip the separator so the day is a
  // bare numeral, and so tabular alignment is not thrown by a trailing period.
  const day = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    timeZone: OSLO_TIME_ZONE,
  })
    .format(value)
    .replace(NON_DIGIT, "");

  return (
    <time
      className={cn(
        "inline-flex w-14 shrink-0 flex-col items-center rounded-biso-sm border border-edge py-1.5 text-center",
        className
      )}
      dateTime={iso}
    >
      <span className="type-label text-ink-muted">{month}</span>
      <span className="type-data text-xl leading-none">{day}</span>
    </time>
  );
}
