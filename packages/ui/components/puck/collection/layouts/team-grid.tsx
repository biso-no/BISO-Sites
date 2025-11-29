"use client";

import { cn } from "../../../../lib/utils";
import { ImageWithFallback } from "../../../image";
import type { CollectionItem, LayoutRendererProps } from "../types";

const GRID_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 md:grid-cols-3",
  4: "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  5: "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
};

function TeamMember({ item }: { item: CollectionItem }) {
  return (
    <div className="group text-center">
      <div className="relative mx-auto mb-4 h-32 w-32 overflow-hidden rounded-full border-4 border-background shadow-lg transition-transform duration-300 group-hover:scale-105">
        <ImageWithFallback
          alt={item.title}
          className="object-cover"
          fill
          src={item.image || "/placeholder-avatar.png"}
        />
      </div>
      <h3 className="font-semibold text-foreground">{item.title}</h3>
      {item.subtitle && (
        <p className="text-muted-foreground text-sm">{item.subtitle}</p>
      )}
      {item.description && (
        <p className="mt-1 text-muted-foreground text-xs">{item.description}</p>
      )}
    </div>
  );
}

export function TeamGridLayout({
  items,
  columns = 4,
}: LayoutRendererProps) {
  const gridClass = GRID_COLS[columns] || GRID_COLS[4];

  return (
    <div className={cn("grid gap-8", gridClass)}>
      {items.map((item) => (
        <TeamMember item={item} key={item.id} />
      ))}
    </div>
  );
}
