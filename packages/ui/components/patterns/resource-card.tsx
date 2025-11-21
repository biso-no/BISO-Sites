import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

export type ResourceMeta = {
  label: string;
  value: string;
};

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
          <h3 className="font-semibold text-lg leading-tight tracking-tight">
            {title}
          </h3>
        </div>
        {excerpt && (
          <p className="mt-2 line-clamp-3 text-muted-foreground text-sm">
            {excerpt}
          </p>
        )}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                className="rounded-full bg-muted px-2 py-0.5 text-[12px] text-muted-foreground"
                key={t}
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {meta.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
            {meta.map((m) => (
              <span className="whitespace-nowrap" key={m.label}>
                <span className="font-medium text-foreground/80">
                  {m.label}:
                </span>{" "}
                {m.value}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Button asChild={Boolean(href)} onClick={onClick} size="sm">
            {href ? <a href={href}>{ctaLabel}</a> : <span>{ctaLabel}</span>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <a className="no-underline" href={href}>
        {Content}
      </a>
    );
  }
  return Content;
}
