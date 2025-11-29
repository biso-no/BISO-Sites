"use client";

import { ArrowRight, Inbox } from "lucide-react";
import Link from "next/link";
import { Button } from "../../ui/button";
import { CardGridLayout } from "./layouts/card-grid";
import { CompactCardLayout } from "./layouts/compact-card";
import { IconFeatureLayout } from "./layouts/icon-feature";
import { LogoGridLayout } from "./layouts/logo-grid";
import { StackedListLayout } from "./layouts/stacked-list";
import { TeamGridLayout } from "./layouts/team-grid";
import type { CollectionProps, CollectionLayout } from "./types";

const LAYOUT_RENDERERS: Record<
  CollectionLayout,
  React.ComponentType<Parameters<typeof CardGridLayout>[0]>
> = {
  "card-grid": CardGridLayout,
  "compact-card": CompactCardLayout,
  "icon-feature": IconFeatureLayout,
  "logo-grid": LogoGridLayout,
  "team-grid": TeamGridLayout,
  "stacked-list": StackedListLayout,
};

const DEFAULT_COLS: Record<CollectionLayout, number> = {
  "card-grid": 3,
  "compact-card": 4,
  "icon-feature": 3,
  "logo-grid": 4,
  "team-grid": 4,
  "stacked-list": 1,
};

export function Collection({
  title,
  subtitle,
  layout = "card-grid",
  columns,
  items = [],
  emptyMessage = "No items to display",
  emptyDescription = "Check back later for updates.",
  ctaLabel,
  ctaHref,
  grayscale,
  cardVariant,
  imageAspect,
}: CollectionProps) {
  const LayoutRenderer = LAYOUT_RENDERERS[layout];
  const effectiveColumns = columns ?? DEFAULT_COLS[layout];

  const hasHeader = Boolean(title || subtitle);
  const hasCta = Boolean(ctaLabel && ctaHref);

  return (
    <div className="w-full">
      {/* Header */}
      {hasHeader && (
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {title && (
              <h2 className="font-semibold text-2xl text-foreground">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {hasCta && ctaHref && (
            <Button asChild size="sm" variant="outline">
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      {items.length > 0 ? (
        <LayoutRenderer
          cardVariant={cardVariant}
          columns={effectiveColumns}
          grayscale={grayscale}
          imageAspect={imageAspect}
          items={items}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium text-foreground">{emptyMessage}</p>
            <p className="text-muted-foreground text-sm">{emptyDescription}</p>
          </div>
        </div>
      )}

      {/* Bottom CTA (if no header) */}
      {hasCta && !hasHeader && ctaHref && (
        <div className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link href={ctaHref}>
              {ctaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
