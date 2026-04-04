"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  /** Renders a badge/chip next to the title */
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  subtitle?: string;
  title: string;
}

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

  const header = (
    <>
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
      <div className="mt-0.5 text-muted-foreground">
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </div>
    </>
  );

  return (
    <div
      className={cn("rounded-xl border border-border/60 bg-card", className)}
    >
      {collapsible ? (
        <button
          aria-expanded={open}
          className={cn(
            "flex w-full items-start justify-between px-6 py-5 text-left",
            "cursor-pointer select-none",
            !open && "rounded-xl"
          )}
          onClick={() => setOpen((o) => !o)}
          type="button"
        >
          {header}
        </button>
      ) : (
        <div className="flex items-start justify-between px-6 py-5">
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
        </div>
      )}

      {(!collapsible || open) && (
        <>
          <div className="mx-6 border-border/40 border-t" />
          <div className="p-6">{children}</div>
        </>
      )}
    </div>
  );
}
