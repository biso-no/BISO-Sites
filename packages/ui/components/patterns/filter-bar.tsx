"use client";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { XIcon } from "lucide-react";
import type * as React from "react";

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  query?: string;
  onQueryChange?: (value: string) => void;
  filters?: { key: string; label: string }[];
  activeFilters?: string[];
  onToggleFilter?: (key: string) => void;
  onClearAll?: () => void;
  placeholder?: string;
  condensed?: boolean;
}

export function FilterBar({
  className,
  query = "",
  onQueryChange,
  filters = [],
  activeFilters = [],
  onToggleFilter,
  onClearAll,
  placeholder = "Search…",
  condensed = false,
  ...props
}: FilterBarProps) {
  const hasActive = activeFilters.length > 0 || Boolean(query);
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[calc(var(--radius))] border bg-background/70 p-3 md:flex-row md:items-center md:gap-4 md:p-4",
        className
      )}
      {...props}
    >
      <div className="flex w-full items-center gap-2 md:max-w-[420px]">
        <Input
          value={query}
          onChange={(e) => onQueryChange?.(e.target.value)}
          placeholder={placeholder}
          className="h-9"
        />
        {hasActive && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearAll}
            className="h-9 px-2"
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Clear filters</span>
          </Button>
        )}
      </div>

      {filters.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            condensed && "md:ml-auto"
          )}
        >
          {filters.map((f) => {
            const active = activeFilters.includes(f.key);
            return (
              <Button
                key={f.key}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => onToggleFilter?.(f.key)}
                className={cn(
                  "rounded-full px-3",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-background"
                )}
              >
                {f.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
