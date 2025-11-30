"use client";

import Link from "next/link";
import { cn } from "../../../../lib/utils";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import type { CollectionItem, LayoutRendererProps } from "../types";

const GRID_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
};

function CompactItem({ item }: { item: CollectionItem }) {
  return (
    <Card className="h-full transition-shadow hover:shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {item.title}
        </CardTitle>
        {item.subtitle && (
          <p className="text-muted-foreground text-sm">{item.subtitle}</p>
        )}
      </CardHeader>
      <CardContent>
        {item.description && (
          <p className="mb-4 text-muted-foreground text-sm">
            {item.description}
          </p>
        )}
        {item.href && (
          <Button asChild className="w-full" size="sm">
            <Link href={item.href}>{item.badge || "View"}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function CompactCardLayout({ items, columns = 4 }: LayoutRendererProps) {
  const gridClass = GRID_COLS[columns] || GRID_COLS[4];

  return (
    <div className={cn("grid gap-6", gridClass)}>
      {items.map((item) => (
        <CompactItem item={item} key={item.id} />
      ))}
    </div>
  );
}
