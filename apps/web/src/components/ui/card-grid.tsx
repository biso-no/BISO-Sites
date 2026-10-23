import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * The listing grid. Three columns on desktop, two on tablet, one on mobile.
 *
 * A single reflow rule, rather than the per-feature grid definitions Phase 0
 * found across events, news, jobs, shop and units.
 */
export type GridColumns = 2 | 3 | 4;

const COLUMNS: Record<GridColumns, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function CardGrid({
  children,
  columns = 3,
  as: Tag = "ul",
  className,
}: {
  children: ReactNode;
  columns?: GridColumns;
  as?: "ul" | "div";
  className?: string;
}) {
  return (
    <Tag className={cn("grid grid-cols-1 gap-5", COLUMNS[columns], className)}>
      {children}
    </Tag>
  );
}
