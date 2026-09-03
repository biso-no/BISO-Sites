import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";

/**
 * A filter row built from links, not state.
 *
 * Phase 0 found filtering implemented as `useState` inside four list clients
 * (`events`, `jobs`, `shop`, `documents`), which means a filtered view cannot
 * be linked, shared, bookmarked or reached by the back button, and the whole
 * list has to be a client component to hold the state.
 *
 * Every chip here is a real `<Link href="?…">`, so a filtered view is a URL:
 * it survives a reload, opens in a new tab on middle-click, and the back button
 * steps through filter changes. It is also the prerequisite for RD-016's
 * `?campus=` work — campus and category compose in one query string.
 *
 * **Other parameters are preserved.** Choosing a category while `?campus=oslo`
 * is set must not drop the campus; each href is built from the current params
 * with only this one changed.
 *
 * The default option clears the parameter rather than setting `?x=all`, so the
 * unfiltered view has one canonical URL rather than two.
 *
 * A group offering only the default renders nothing. Options are derived from
 * the data, so a feed where no row carries the attribute would otherwise show a
 * lone "All" chip that filters nothing — furniture that looks like a control.
 */
const MIN_OPTIONS = 2;

export interface FilterOption {
  /** Optional count, as the reference shows beside filters. */
  count?: number;
  label: string;
  value: string;
}

export interface FilterChipsProps {
  /** Currently selected value; falls back to `defaultValue`. */
  active?: string;
  /** Path the links point at. Defaults to the current path via a bare query. */
  basePath?: string;
  className?: string;
  /** The value meaning "no filter". Selecting it removes the parameter. */
  defaultValue?: string;
  /** Accessible name for the group, e.g. "Filter events by category". */
  label: string;
  options: FilterOption[];
  /** Query parameter this row controls, e.g. "category". */
  param: string;
  /** Current query string, so unrelated parameters survive. */
  searchParams?: Record<string, string | string[] | undefined>;
}

function hrefFor(
  param: string,
  value: string,
  defaultValue: string,
  searchParams: Record<string, string | string[] | undefined>,
  basePath?: string
): string {
  const next = new URLSearchParams();
  for (const [key, raw] of Object.entries(searchParams)) {
    if (key === param || raw === undefined) {
      continue;
    }
    for (const v of Array.isArray(raw) ? raw : [raw]) {
      next.append(key, v);
    }
  }
  if (value !== defaultValue) {
    next.set(param, value);
  }
  const query = next.toString();
  return `${basePath ?? ""}${query ? `?${query}` : ""}` || (basePath ?? "?");
}

export function FilterChips({
  param,
  options,
  active,
  defaultValue = "all",
  searchParams = {},
  basePath,
  label,
  className,
}: FilterChipsProps) {
  const current = active ?? defaultValue;

  // Fewer than two choices is not a choice.
  if (options.length < MIN_OPTIONS) {
    return null;
  }

  return (
    <nav aria-label={label} className={cn("w-full", className)}>
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option.value === current;
          return (
            <li key={option.value}>
              <Link
                // `aria-current` is what tells a screen reader which filter is
                // applied; colour alone would not.
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "type-body-sm inline-flex items-center gap-1.5 rounded-biso-pill border px-3 py-1.5 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  isActive
                    ? "border-transparent bg-action font-medium text-action-ink"
                    : "border-edge text-ink-muted hover:border-ink-accent hover:text-ink"
                )}
                href={hrefFor(
                  param,
                  option.value,
                  defaultValue,
                  searchParams,
                  basePath
                )}
                scroll={false}
              >
                {option.label}
                {option.count === undefined ? null : (
                  <span className="type-data opacity-70">{option.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
