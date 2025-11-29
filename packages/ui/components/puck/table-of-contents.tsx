"use client";

import { List } from "lucide-react";
import Link from "next/link";
import { cn } from "../../lib/utils";

export type TocItem = {
  title: string;
  anchor: string;
  level?: 1 | 2 | 3;
};

export type TableOfContentsProps = {
  title?: string;
  items: TocItem[];
  variant?: "default" | "card" | "sticky";
  showIcon?: boolean;
};

/**
 * TableOfContents block for navigation on long documents.
 * Links to sections using anchor IDs.
 */
export function TableOfContents({
  title = "Table of Contents",
  items = [],
  variant = "default",
  showIcon = true,
}: TableOfContentsProps) {
  if (items.length === 0) {
    return null;
  }

  const levelClasses = {
    1: "font-medium",
    2: "pl-4 text-sm",
    3: "pl-8 text-sm text-muted-foreground",
  };

  const content = (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        {showIcon && <List className="h-5 w-5 text-primary" />}
        <h2 className="font-semibold text-lg">{title}</h2>
      </div>

      {/* Links */}
      <nav aria-label="Table of contents">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.anchor}>
              <Link
                className={cn(
                  "block py-1 text-muted-foreground transition-colors hover:text-foreground",
                  levelClasses[item.level ?? 1]
                )}
                href={`#${item.anchor}`}
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );

  if (variant === "card") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6">
        {content}
      </div>
    );
  }

  if (variant === "sticky") {
    return (
      <div className="sticky top-24 rounded-lg border border-border bg-background p-6 shadow-sm">
        {content}
      </div>
    );
  }

  return <div className="py-4">{content}</div>;
}
