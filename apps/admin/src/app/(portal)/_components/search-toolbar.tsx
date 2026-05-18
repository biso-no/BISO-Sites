"use client";

import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { STUDIO } from "./studio";

interface ChipFilter {
  label: string;
  value: string;
}

interface SearchToolbarProps {
  activeFilter?: string;
  children?: ReactNode;
  defaultSearch?: string;
  filters?: ChipFilter[];
  onFilterChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
}

export function SearchToolbar({
  placeholder = "Search...",
  defaultSearch = "",
  onSearch,
  filters,
  activeFilter,
  onFilterChange,
  children,
}: SearchToolbarProps) {
  const [value, setValue] = useState(defaultSearch);
  const [, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    startTransition(() => {
      onSearch?.(v);
    });
  }

  function handleClear() {
    setValue("");
    onSearch?.("");
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Search input */}
      <div className="relative max-w-sm flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          size={15}
          style={{ color: STUDIO.ink4 }}
        />
        <input
          className="w-full rounded-lg py-2.5 pr-9 pl-9 text-sm outline-none transition-all"
          onBlur={(e) => {
            e.currentTarget.style.borderColor = STUDIO.rule2;
          }}
          onChange={handleChange}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = STUDIO.claret;
          }}
          placeholder={placeholder}
          style={{
            background: "rgba(255,255,255,0.62)",
            border: `0.5px solid ${STUDIO.rule2}`,
            color: STUDIO.ink,
          }}
          type="text"
          value={value}
        />
        {value && (
          <button
            className="absolute top-1/2 right-3 -translate-y-1/2"
            onClick={handleClear}
            style={{ color: STUDIO.ink4 }}
            type="button"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter chips */}
      {filters && filters.length > 0 && (
        <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto">
          {filters.map((chip) => {
            const isActive = activeFilter === chip.value;
            return (
              <button
                className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-xs transition-all"
                key={chip.value}
                onClick={() => onFilterChange?.(chip.value)}
                style={
                  isActive
                    ? {
                        background: "#fff",
                        border: `0.5px solid ${STUDIO.rule2}`,
                        boxShadow: "0 1px 2px rgba(26,24,20,0.06)",
                        color: STUDIO.ink,
                      }
                    : {
                        background: STUDIO.paper2,
                        border: `0.5px solid ${STUDIO.rule2}`,
                        color: STUDIO.ink3,
                      }
                }
                type="button"
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Right-side slot (buttons, etc.) */}
      {children && (
        <div className="ml-auto flex items-center gap-2">{children}</div>
      )}
    </div>
  );
}
