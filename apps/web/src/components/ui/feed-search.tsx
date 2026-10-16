"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { Search } from "lucide-react";

/**
 * Search for a feed, as a real GET form.
 *
 * Generalised from `news-search.tsx` when PR feedback surfaced that `/events`
 * and `/jobs` lost their v1 search entirely — `/jobs` still filtered on `?q=`
 * server-side with no way to type one, and `/events` had neither the control
 * nor the filter. `news`, `units` and `shop` each still carry their own older
 * copy of this; folding them in is worth doing but is not this change.
 *
 * A `<form method="get">` submits to the URL the server already reads, so it
 * works before hydration, produces a shareable URL, and lets the browser's own
 * history handle back and forward.
 *
 * Client only for the `search` analytics event. `onSubmit` deliberately does
 * not `preventDefault` — the native submission proceeds either way, so losing
 * the script loses the metric and nothing else.
 *
 * The query itself is never sent: a visitor may search their own name or
 * student number, so only the non-PII fact that a search happened and its
 * length are reported.
 */
export interface FeedSearchProps {
  /** The feed's own path, e.g. `/events`. */
  action: string;
  defaultValue: string;
  /** Parameters carried through the submission, e.g. the active campus. */
  hidden: Record<string, string>;
  label: string;
  /** Query parameter this feed reads — `search` for most, `q` for jobs. */
  name: string;
  placeholder: string;
  submitLabel: string;
  /** Analytics surface, e.g. `events`. */
  surface: string;
}

export function FeedSearch({
  action,
  defaultValue,
  hidden,
  label,
  name,
  placeholder,
  submitLabel,
  surface,
}: FeedSearchProps) {
  return (
    <form
      action={action}
      className="flex w-full max-w-md items-center gap-2"
      method="get"
      onSubmit={(event) => {
        const value = new FormData(event.currentTarget)
          .get(name)
          ?.toString()
          .trim();
        if (value) {
          trackEvent("search", { surface, queryLength: value.length });
        }
      }}
    >
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} name={key} type="hidden" value={value} />
      ))}

      <label className="relative flex min-w-0 flex-1 items-center">
        <span className="sr-only">{label}</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 size-4 text-ink-muted"
        />
        <input
          className="type-body-sm w-full rounded-biso-pill border border-edge bg-surface py-2 ps-9 pe-3 text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          defaultValue={defaultValue}
          name={name}
          placeholder={placeholder}
          type="search"
        />
      </label>

      <button
        className="type-label shrink-0 rounded-biso-pill border border-edge px-4 py-2 text-ink transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        type="submit"
      >
        {submitLabel}
      </button>
    </form>
  );
}
