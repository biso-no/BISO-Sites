"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { Search } from "lucide-react";

/**
 * The news search, as a real GET form.
 *
 * v1 holds the query in `useState` and pushes it with `router.push`, so the
 * control needs JavaScript to do anything at all. A `<form method="get">`
 * submits to the same URL the server already reads (`?search=`, filtered in
 * `filterArticles`), which means it works before hydration, the result is a
 * shareable URL, and the browser's own history handles back and forward.
 *
 * It is still a Client Component for exactly one reason: the `search`
 * analytics event. `onSubmit` does **not** call `preventDefault` — the native
 * submission proceeds either way, so losing the script loses the metric and
 * nothing else.
 *
 * The query itself is never sent. A visitor may search their own name, email or
 * student number; only the non-PII fact that a search happened and its length
 * go to analytics — the same rule v1 established.
 */
export interface NewsSearchProps {
  defaultValue: string;
  /** Parameters to carry through the submission, e.g. the active campus. */
  hidden: Record<string, string>;
  label: string;
  placeholder: string;
  submitLabel: string;
}

export function NewsSearch({
  defaultValue,
  hidden,
  label,
  placeholder,
  submitLabel,
}: NewsSearchProps) {
  return (
    <form
      action="/news"
      className="flex w-full max-w-md items-center gap-2"
      method="get"
      onSubmit={(event) => {
        const value = new FormData(event.currentTarget)
          .get("search")
          ?.toString()
          .trim();
        if (value) {
          trackEvent("search", { surface: "news", queryLength: value.length });
        }
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
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
          name="search"
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
