import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

export interface ResourceMeta {
  label: string;
  value: string;
}

export interface ResourceCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  href?: string;
  excerpt?: string;
  tags?: string[];
  meta?: ResourceMeta[];
  ctaLabel?: string;
  onClick?: () => void;
}

export function ResourceCard({
  className,
  title,
  href,
  excerpt,
  tags = [],
  meta = [],
  ctaLabel = "View",
  onClick,
  ...props
}: ResourceCardProps) {
  const Content = (
    <Card className={cn("group transition-colors", className)} {...props}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-tight tracking-tight">
            {title}
          </h3>
        </div>
        {excerpt && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
            {excerpt}
          </p>
        )}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-2 py-0.5 text-[12px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {meta.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {meta.map((m) => (
              <span key={m.label} className="whitespace-nowrap">
                <span className="font-medium text-foreground/80">
                  {m.label}:
                </span>{" "}
                {m.value}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Button size="sm" onClick={onClick} asChild={Boolean(href)}>
            {href ? <a href={href}>{ctaLabel}</a> : <span>{ctaLabel}</span>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <a href={href} className="no-underline">
        {Content}
      </a>
    );
  }
  return Content;
}
