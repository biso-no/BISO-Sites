export type SourceFilter = "all" | "manual" | "auto";

export const SOURCE_FILTERS: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "manual", label: "Manual" },
  { id: "auto", label: "Automatic" },
];

/** The `?source=` value as a filter; anything unknown means All. */
export function parseSourceFilter(value: string | undefined): SourceFilter {
  return value === "manual" || value === "auto" ? value : "all";
}
