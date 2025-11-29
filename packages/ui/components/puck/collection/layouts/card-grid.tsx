"use client";

import { ArrowRight, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { cn } from "../../../../lib/utils";
import { ImageWithFallback } from "../../../image";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent } from "../../../ui/card";
import type { CollectionItem, LayoutRendererProps } from "../types";

const GRID_COLS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
};

const ASPECT: Record<string, string> = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
};

function CardItem({
  item,
  variant = "default",
  aspect = "video",
}: {
  item: CollectionItem;
  variant?: "default" | "bordered" | "elevated";
  aspect?: "square" | "video" | "portrait";
}) {
  const cardClasses = cn(
    "group overflow-hidden transition-all duration-300",
    variant === "bordered" && "border hover:border-primary/30",
    variant === "elevated" && "shadow-md hover:shadow-xl",
    variant === "default" && "border-0 shadow-lg hover:shadow-xl"
  );

  const content = (
    <Card className={cardClasses}>
      {item.image && (
        <div className={cn("relative overflow-hidden", ASPECT[aspect])}>
          <ImageWithFallback
            alt={item.title}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            fill
            src={item.image}
          />
          {item.badge && (
            <Badge className="absolute top-3 left-3 bg-primary/90">
              {item.badge}
            </Badge>
          )}
        </div>
      )}
      <CardContent className="space-y-3 p-5">
        <h3 className="line-clamp-2 font-semibold text-foreground text-lg">
          {item.title}
        </h3>
        {item.subtitle && (
          <p className="line-clamp-2 text-muted-foreground text-sm">
            {item.subtitle}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
          {item.date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {item.date}
            </span>
          )}
          {typeof item.metadata?.location === "string" && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {item.metadata.location}
            </span>
          )}
        </div>
        {item.href && (
          <Button
            className="mt-2 w-full gap-2"
            size="sm"
            variant="outline"
          >
            View Details
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );

  if (item.href) {
    return (
      <Link className="block" href={item.href}>
        {content}
      </Link>
    );
  }
  return content;
}

export function CardGridLayout({
  items,
  columns = 3,
  cardVariant = "default",
  imageAspect = "video",
}: LayoutRendererProps) {
  const gridClass = GRID_COLS[columns] || GRID_COLS[3];

  return (
    <div className={cn("grid gap-6", gridClass)}>
      {items.map((item) => (
        <CardItem
          aspect={imageAspect}
          item={item}
          key={item.id}
          variant={cardVariant}
        />
      ))}
    </div>
  );
}
