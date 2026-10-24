import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A link when there is somewhere to go, and plain markup when there is not.
 *
 * `events.slug` and `news.slug` are both nullable in the schema, so a published
 * row can have no detail URL. `/events/${event.slug}` then renders
 * `/events/null` — a guaranteed 404 that looks like a working card. The events
 * feed already guarded this inline; the homepage and campus previews did not,
 * which PR review caught. This is that guard, in one place, so the next feed
 * cannot forget it.
 *
 * The row stays visible either way: the content is real even when the link is
 * not, and hiding it would lose an event a reader can still see the date of.
 */
export function OptionalLink({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className?: string;
  /** `null` when the row has no slug to build a detail URL from. */
  href: string | null;
}) {
  if (!href) {
    return <div className={className}>{children}</div>;
  }
  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}
