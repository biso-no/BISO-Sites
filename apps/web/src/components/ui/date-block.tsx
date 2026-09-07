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
  const iso = value.toISOString().slice(0, 10);
  // Formatted in UTC, matching the `dateTime` above it. Content dates are
  // stored as the editor's wall clock with a `+00:00` stamp (the admin studio
  // round-trips `<input type="datetime-local">` with a plain string slice), so
  // reading them back in the server's local zone can move an evening event to
  // the following day. UTC prints the day that was typed, on every host.
  const month = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  })
    .format(value)
    .replace(".", "")
    .toUpperCase();
  // Norwegian ordinals render as "22." — strip the separator so the day is a
  // bare numeral, and so tabular alignment is not thrown by a trailing period.
  const day = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    timeZone: "UTC",
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
