"use client";

import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import type { ReactNode } from "react";

type ChipFilter = {
  label: string;
  value: string;
};

type SearchToolbarProps = {
  placeholder?: string;
  defaultSearch?: string;
  onSearch?: (value: string) => void;
  filters?: ChipFilter[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  children?: ReactNode;
};

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
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      {/* Search input */}
      <div className="relative flex-1 max-w-sm">
        <Search
          size={15}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "rgba(255,255,255,0.30)" }}
        />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2.5 text-sm rounded-2xl outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(61,169,224,0.50)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          }}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: "rgba(255,255,255,0.40)" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter chips */}
      {filters && filters.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          {filters.map((chip) => {
            const isActive = activeFilter === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => onFilterChange?.(chip.value)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap"
                style={
                  isActive
                    ? {
                        background: "rgba(61,169,224,0.15)",
                        border: "1px solid rgba(61,169,224,0.40)",
                        color: "#3DA9E0",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.50)",
                      }
                }
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Right-side slot (buttons, etc.) */}
      {children && (
        <div className="flex items-center gap-2 ml-auto">{children}</div>
      )}
    </div>
  );
}
