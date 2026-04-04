"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type FormSectionProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  /** Renders a badge/chip next to the title */
  badge?: React.ReactNode;
};

export function FormSection({
  title,
  subtitle,
  children,
  collapsible = false,
  defaultOpen = true,
  className,
  badge,
}: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn("rounded-xl border border-border/60 bg-card", className)}
    >
      <div
        aria-expanded={collapsible ? open : undefined}
        className={cn(
          "flex items-start justify-between px-6 py-5",
          collapsible && "cursor-pointer select-none",
          collapsible && !open && "rounded-xl"
        )}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen((o) => !o);
                }
              }
            : undefined
        }
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm leading-none tracking-tight">
              {title}
            </h3>
            {badge}
          </div>
          {subtitle && (
            <p className="text-muted-foreground text-xs">{subtitle}</p>
          )}
        </div>
        {collapsible && (
          <div className="mt-0.5 text-muted-foreground">
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        )}
      </div>

      {(!collapsible || open) && (
        <>
          <div className="mx-6 border-border/40 border-t" />
          <div className="p-6">{children}</div>
        </>
      )}
    </div>
  );
}
