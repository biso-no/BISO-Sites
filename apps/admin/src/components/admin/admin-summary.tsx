"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

interface SummaryMetric {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

interface AdminSummaryProps {
  badge?: string;
  title: string;
  description?: ReactNode;
  metrics?: SummaryMetric[];
  action?: ReactNode;
  footer?: ReactNode;
  slot?: ReactNode;
  className?: string;
}

export const AdminSummary = ({
  badge,
  title,
  description,
  metrics = [],
  action,
  footer,
  slot,
  className,
}: AdminSummaryProps) => {
  return (
    <section
      className={cn(
        "surface-spotlight glass-panel accent-ring relative overflow-hidden rounded-3xl border border-primary/10 px-6 py-6 sm:px-8 sm:py-8",
        className,
      )}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          {badge && (
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-primary-70"
            >
              {badge}
            </Badge>
          )}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-primary-100 sm:text-3xl">
              {title}
            </h1>
            {description && <p className="text-sm text-primary-60 sm:text-base">{description}</p>}
          </div>
          {slot}
        </div>
        {action}
      </div>
      {metrics.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-primary/10 px-4 py-4 shadow-[0_20px_45px_-32px_rgba(0,23,49,0.45)] backdrop-blur"
            >
              <span className="text-[0.65rem] uppercase tracking-[0.18em] text-primary-50">
                {metric.label}
              </span>
              <span className="mt-1 block text-lg font-semibold text-primary-100">
                {metric.value}
              </span>
              {metric.hint && <span className="text-xs text-primary-60">{metric.hint}</span>}
            </div>
          ))}
        </div>
      )}
      {footer && (
        <div className="mt-4 text-xs uppercase tracking-[0.16em] text-primary-60">{footer}</div>
      )}
    </section>
  );
};
