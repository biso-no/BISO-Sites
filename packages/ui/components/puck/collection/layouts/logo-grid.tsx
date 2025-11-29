"use client";

import Link from "next/link";
import { cn } from "../../../../lib/utils";
import { ImageWithFallback } from "../../../image";
import type { CollectionItem, LayoutRendererProps } from "../types";

const GRID_COLS: Record<number, string> = {
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-6",
};

function LogoItem({
  item,
  grayscale,
}: {
  item: CollectionItem;
  grayscale?: boolean;
}) {
  const content = (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-xl border border-border bg-white p-6 transition-all duration-300 hover:border-primary/20 hover:shadow-md",
        grayscale && "opacity-70 grayscale hover:opacity-100 hover:grayscale-0"
      )}
    >
      <div className="relative h-12 w-full sm:h-16">
        <ImageWithFallback
          alt={item.title}
          className="object-contain"
          fill
          src={item.image || ""}
        />
      </div>
    </div>
  );

  if (item.href) {
    return (
      <Link
        className="block"
        href={item.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {content}
      </Link>
    );
  }
  return content;
}

export function LogoGridLayout({
  items,
  columns = 4,
  grayscale = true,
}: LayoutRendererProps) {
  const gridClass = GRID_COLS[columns] || GRID_COLS[4];

  return (
    <div className={cn("grid items-center gap-6", gridClass)}>
      {items.map((item) => (
        <LogoItem grayscale={grayscale} item={item} key={item.id} />
      ))}
    </div>
  );
}
