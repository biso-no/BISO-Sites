export type GridColumns = 2 | 3 | 4;

const STEPS: Record<GridColumns, string> = {
  2: "",
  3: " @3xl:grid-cols-3",
  4: " @3xl:grid-cols-4",
};

/**
 * Listing grid classes. Container variants, because the page sits in a
 * container whose width, not the viewport's, decides the layout.
 */
export function cardGridClass(columns: GridColumns): string {
  return `grid gap-5 grid-cols-1 @md:grid-cols-2${STEPS[columns] ?? ""}`;
}
