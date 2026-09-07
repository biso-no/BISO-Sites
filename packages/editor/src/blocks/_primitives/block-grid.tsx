"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

export const GRID_COLUMNS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

interface BlockGridProps {
  children: ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}

export const BlockGrid = ({
  children,
  className,
  columns = 3,
}: BlockGridProps) => (
  <div className={cn("grid gap-6 lg:gap-8", GRID_COLUMNS[columns], className)}>
    {children}
  </div>
);
