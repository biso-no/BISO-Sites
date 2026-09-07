import { Search } from "lucide-react";

/**
 * Product search as a real GET form, the same shape `<NewsSearch>` takes.
 *
 * v1 kept the query in `useState` and never put it in the URL at all, so a
 * search result could not be linked, bookmarked or reached with the back
 * button, and the whole list had to be a Client Component to hold it.
 *
 * Unlike the news form this ships no JavaScript at all. v1's shop search
 * emitted no analytics event, and adding one is a measurement decision rather
 * than part of a restyle — which leaves nothing for a script to do, so the form
 * is a plain Server Component.
 */
export interface ShopSearchProps {
  defaultValue: string;
  /** Parameters to carry through the submission, e.g. campus and category. */
  hidden: Record<string, string>;
  label: string;
  placeholder: string;
  submitLabel: string;
}

export function ShopSearch({
  defaultValue,
  hidden,
  label,
  placeholder,
  submitLabel,
}: ShopSearchProps) {
  return (
    <form
      action="/shop"
      className="flex w-full max-w-md items-center gap-2"
      method="get"
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
