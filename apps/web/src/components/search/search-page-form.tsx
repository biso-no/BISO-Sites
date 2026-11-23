"use client";

import { trackEvent } from "@repo/shared/utils/analytics";

/**
 * The search field in the band, as a real GET form. Client only for the
 * `search` analytics event (length, never the text); the native submission
 * proceeds either way, so the page works without JavaScript.
 */
export function SearchPageForm({
  defaultValue,
  hidden,
  label,
  placeholder,
  submitLabel,
}: {
  defaultValue: string;
  hidden: Record<string, string>;
  label: string;
  placeholder: string;
  submitLabel: string;
}) {
  return (
    <form
      action="/search"
      className="mt-6 flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
      method="get"
      onSubmit={(event) => {
        const value = new FormData(event.currentTarget)
          .get("q")
          ?.toString()
          .trim();
        if (value) {
          trackEvent("search", {
            surface: "search-page",
            queryLength: value.length,
          });
        }
      }}
    >
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} name={key} type="hidden" value={value} />
      ))}
      <label className="min-w-0 flex-1">
        <span className="sr-only">{label}</span>
        <input
          autoComplete="off"
          className="w-full rounded-biso-md border border-edge bg-white px-4 py-3 font-black font-display text-deep text-xl placeholder:text-deep/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          defaultValue={defaultValue}
          enterKeyHint="search"
          maxLength={100}
          name="q"
          placeholder={placeholder}
          type="search"
        />
      </label>
      <button
        className="type-label shrink-0 rounded-biso-pill bg-action px-6 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        type="submit"
      >
        {submitLabel}
      </button>
    </form>
  );
}
