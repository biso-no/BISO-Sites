import { Search } from "lucide-react";

/**
 * Unit search as a real GET form, the same shape the shop and news forms take.
 *
 * v1 filtered a client-held list, so a filtered view had no URL — and the list
 * it filtered was empty anyway.
 *
 * A plain Server Component: no analytics event to fire, so no JavaScript.
 */
export interface UnitSearchProps {
  defaultValue: string;
  /** Parameters to carry through the submission, e.g. campus and category. */
  hidden: Record<string, string>;
  label: string;
  placeholder: string;
  submitLabel: string;
}

export function UnitSearch({
  defaultValue,
  hidden,
  label,
  placeholder,
  submitLabel,
}: UnitSearchProps) {
  return (
    <form
      action="/units"
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
