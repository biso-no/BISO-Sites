"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { CollectionItem, LayoutRendererProps } from "../types";

function ListItem({ item }: { item: CollectionItem }) {
  const content = (
    <div className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/20 hover:shadow-md">
      <div className="flex-1 space-y-2">
        <h3 className="font-semibold text-foreground">{item.title}</h3>
        {item.subtitle && (
          <p className="text-muted-foreground text-sm">{item.subtitle}</p>
        )}
        {item.description && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {item.description}
          </p>
        )}
        {item.badge && (
          <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
            {item.badge}
          </span>
        )}
      </div>
      {item.href && (
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      )}
    </div>
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

export function StackedListLayout({ items }: LayoutRendererProps) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <ListItem item={item} key={item.id} />
      ))}
    </div>
  );
}
