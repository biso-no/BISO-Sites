"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

type SummaryMetric = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
};

type AdminSummaryProps = {
  badge?: string;
  title: string;
  description?: ReactNode;
  metrics?: SummaryMetric[];
  action?: ReactNode;
  footer?: ReactNode;
  slot?: ReactNode;
  className?: string;
};

export const AdminSummary = ({
  badge,
  title,
  description,
  metrics = [],
  action,
  footer,
  slot,
  className,
}: AdminSummaryProps) => (
  <section
    className={cn(
      "surface-spotlight glass-panel relative overflow-hidden rounded-3xl border border-primary/10 px-6 py-6 accent-ring sm:px-8 sm:py-8",
      className
    )}
  >
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-3">
        {badge && (
          <Badge
            className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 font-semibold text-[0.65rem] text-primary-70 uppercase tracking-[0.18em]"
            variant="outline"
          >
            {badge}
          </Badge>
        )}
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl text-primary-100 tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="text-primary-60 text-sm sm:text-base">
              {description}
            </p>
          )}
        </div>
        {slot}
      </div>
      {action}
    </div>
    {metrics.length > 0 && (
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            className="rounded-2xl border border-primary/10 px-4 py-4 shadow-[0_20px_45px_-32px_rgba(0,23,49,0.45)] backdrop-blur"
            key={metric.label}
          >
            <span className="text-[0.65rem] text-primary-50 uppercase tracking-[0.18em]">
              {metric.label}
            </span>
            <span className="mt-1 block font-semibold text-lg text-primary-100">
              {metric.value}
            </span>
            {metric.hint && (
              <span className="text-primary-60 text-xs">{metric.hint}</span>
            )}
          </div>
        ))}
      </div>
    )}
    {footer && (
      <div className="mt-4 text-primary-60 text-xs uppercase tracking-[0.16em]">
        {footer}
      </div>
    )}
  </section>
);
