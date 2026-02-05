"use client";

import { cn } from "../../lib/utils";

export type TextProps = {
  content: string;
  variant?: "default" | "compact" | "lead";
  columns?: 1 | 2;
  align?: "left" | "center";
};

export function Text({
  content,
  variant = "default",
  columns = 1,
  align = "left",
}: TextProps) {
  const variantClasses = {
    default: "prose-lg",
    compact: "prose-sm",
    lead: "prose-lg prose-p:text-lg",
  } as const;

  const alignClasses = {
    left: "text-left",
    center: "text-center",
  } as const;

  return (
    <div
      className={cn(
        "prose prose-slate dark:prose-invert mx-auto max-w-none",
        variantClasses[variant],
        alignClasses[align],
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-p:text-muted-foreground",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-strong:text-foreground",
        "prose-li:text-muted-foreground",
        columns === 2 && "lg:columns-2 lg:gap-12"
      )}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Puck richtext output is controlled by the editor UI.
      dangerouslySetInnerHTML={{ __html: content ?? "" }}
    />
  );
}

