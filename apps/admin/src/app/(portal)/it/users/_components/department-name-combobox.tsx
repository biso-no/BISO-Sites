"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { STUDIO } from "../../../_components/studio";

interface DepartmentNameComboboxProps {
  ariaLabel: string;
  disabled?: boolean;
  names: string[];
  onChange: (name: string | null) => void;
  placeholder: string;
  searchPlaceholder: string;
  value: string | null;
}

export function DepartmentNameCombobox({
  ariaLabel,
  disabled,
  names,
  onChange,
  placeholder,
  searchPlaceholder,
  value,
}: DepartmentNameComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  const filtered = search.trim()
    ? names.filter((name) =>
        name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : names;

  return (
    <div ref={containerRef} style={{ position: "relative", minWidth: 240 }}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        style={{
          borderColor: STUDIO.rule2,
          color: value ? STUDIO.ink2 : STUDIO.ink4,
          opacity: disabled ? 0.5 : 1,
        }}
        type="button"
      >
        <span className="truncate">{value ?? placeholder}</span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: STUDIO.ink4 }} />
      </button>

      {open && (
        <div
          aria-label={ariaLabel}
          className="absolute right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border bg-white shadow-lg"
          role="listbox"
          style={{ borderColor: STUDIO.rule2 }}
        >
          <input
            aria-label={searchPlaceholder}
            className="w-full border-b px-3 py-2 text-sm outline-none"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            ref={searchRef}
            style={{ borderColor: STUDIO.rule }}
            type="search"
            value={search}
          />
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm" style={{ color: STUDIO.ink4 }}>
                {placeholder}
              </p>
            ) : (
              filtered.map((name) => (
                <button
                  aria-selected={name === value}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5"
                  key={name}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                    setSearch("");
                  }}
                  role="option"
                  style={{
                    background:
                      name === value ? "rgba(0,0,0,0.05)" : "transparent",
                    color: STUDIO.ink2,
                  }}
                  type="button"
                >
                  {name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
