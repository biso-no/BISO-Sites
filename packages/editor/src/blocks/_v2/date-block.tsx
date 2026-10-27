const OSLO = "Europe/Oslo";
const NON_DIGIT = /\D/g;

/**
 * The stacked month/day marker. Formatted in Oslo time: an event's day is the
 * day it happens in Norway, whatever the server's zone. Renders nothing for an
 * unparseable date.
 */
export function DateBlock({
  iso,
  locale = "no",
}: {
  iso: string;
  locale?: string;
}) {
  const value = new Date(typeof iso === "string" ? iso : Number.NaN);
  if (Number.isNaN(value.getTime())) {
    return null;
  }
  const tag = locale === "en" ? "en-GB" : "nb-NO";
  // `en-CA` formats as YYYY-MM-DD.
  const dateTime = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: OSLO,
    year: "numeric",
  }).format(value);
  const month = new Intl.DateTimeFormat(tag, {
    month: "short",
    timeZone: OSLO,
  })
    .format(value)
    .replace(".", "")
    .toUpperCase();
  const day = new Intl.DateTimeFormat(tag, { day: "2-digit", timeZone: OSLO })
    .format(value)
    .replace(NON_DIGIT, "");

  return (
    <time
      className="inline-flex w-14 shrink-0 flex-col items-center rounded-biso-sm border border-edge py-1.5 text-center"
      dateTime={dateTime}
    >
      <span className="type-label text-ink-muted">{month}</span>
      <span className="type-data text-xl leading-none">{day}</span>
    </time>
  );
}
