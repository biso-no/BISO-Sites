"use client";

import type { Departments } from "@repo/api/types/appwrite";
import { useEffect, useRef, useState } from "react";
import { listDepartmentsForCampus } from "../_actions/lookups";

interface DepartmentComboboxProps {
  campusId: string | null;
  disabled?: boolean;
  initialDepartments?: Departments[];
  label?: string;
  onChange: (id: string | null, name?: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string | null;
}

const STYLES = {
  crest: {
    background: "#f3eee5",
    borderRadius: "6px",
    color: "#1a1814",
    display: "grid",
    flexShrink: 0,
    fontFamily: "Georgia, serif",
    fontSize: "13px",
    height: "24px",
    placeItems: "center",
    width: "24px",
  },
  dropdown: {
    background: "white",
    border: "0.5px solid #d8cdb6",
    borderRadius: "10px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
    left: 0,
    overflow: "hidden",
    position: "absolute" as const,
    right: 0,
    top: "calc(100% + 4px)",
    zIndex: 50,
  },
  listItem: {
    alignItems: "center",
    cursor: "pointer",
    display: "flex",
    fontSize: "13.5px",
    gap: "10px",
    padding: "9px 14px",
  },
  searchInput: {
    background: "transparent",
    border: 0,
    borderBottom: "0.5px solid #e5dcca",
    fontSize: "13.5px",
    outline: 0,
    padding: "10px 14px",
    width: "100%",
  },
  trigger: {
    alignItems: "center",
    background: "rgba(255,255,255,.6)",
    border: "0.5px solid #d8cdb6",
    borderRadius: "8px",
    color: "#1a1814",
    cursor: "pointer",
    display: "flex",
    fontSize: "14px",
    gap: "8px",
    justifyContent: "space-between",
    padding: "9px 12px",
    textAlign: "left" as const,
    width: "100%",
  },
  triggerDisabled: {
    background: "#f3eee5",
    cursor: "not-allowed",
    opacity: 0.5,
  },
} as const;

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      fill="none"
      height="14"
      stroke="#9c9385"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      style={{
        flexShrink: 0,
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 150ms",
      }}
      viewBox="0 0 24 24"
      width="14"
    >
      <title>{open ? "Collapse" : "Expand"}</title>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function DepartmentCombobox({
  campusId,
  disabled,
  initialDepartments,
  label,
  onChange,
  placeholder = "Select department",
  required,
  value,
}: DepartmentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Departments[]>(initialDepartments ?? []);
  const [loading, setLoading] = useState(false);

  const cacheRef = useRef<Map<string, Departments[]>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const prevCampusRef = useRef(campusId);

  // Seed cache from initialDepartments on mount only
  const mountRef = useRef(false);
  useEffect(() => {
    if (mountRef.current) {
      return;
    }
    mountRef.current = true;
    if (initialDepartments && campusId) {
      cacheRef.current.set(campusId, initialDepartments);
      setItems(initialDepartments);
    }
  });

  // Load departments when campusId changes
  useEffect(() => {
    if (!campusId) {
      setItems([]);
      return;
    }
    const cached = cacheRef.current.get(campusId);
    if (cached) {
      setItems(cached);
      return;
    }
    setLoading(true);
    listDepartmentsForCampus(campusId).then((rows) => {
      cacheRef.current.set(campusId, rows);
      setItems(rows);
      setLoading(false);
    });
  }, [campusId]);

  // Reset value when campus changes
  useEffect(() => {
    if (prevCampusRef.current !== campusId && campusId !== null) {
      onChange(null);
    }
    prevCampusRef.current = campusId;
  }, [campusId, onChange]);

  // Close on outside click
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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  const isDisabled = disabled || !campusId;
  const selectedItem = items.find((item) => item.$id === value) ?? null;
  const filtered = search.trim()
    ? items.filter((item) =>
        item.Name.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  function handleSelect(item: Departments) {
    onChange(item.$id, item.Name);
    setOpen(false);
    setSearch("");
  }

  function handleTriggerClick() {
    if (isDisabled) {
      return;
    }
    setOpen((prev) => !prev);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  }

  const triggerLabel = isDisabled
    ? "Pick a campus first"
    : (selectedItem?.Name ?? placeholder);
  const triggerStyle = isDisabled
    ? { ...STYLES.trigger, ...STYLES.triggerDisabled }
    : STYLES.trigger;
  const triggerLabelColor = isDisabled || !selectedItem ? "#9c9385" : "#1a1814";

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      {label && (
        <span
          style={{
            color: "#6b6357",
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {label}
          {required && (
            <span aria-hidden style={{ color: "#ef4444", marginLeft: "4px" }}>
              *
            </span>
          )}
        </span>
      )}
      <div ref={containerRef} style={{ position: "relative" }}>
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={label ?? "Department"}
          disabled={isDisabled}
          onClick={handleTriggerClick}
          onKeyDown={handleKeyDown}
          style={triggerStyle}
          type="button"
        >
          <span style={{ color: triggerLabelColor, flex: 1, minWidth: 0 }}>
            {triggerLabel}
          </span>
          {loading ? (
            <span
              role="status"
              style={{
                animation: "dept-spin 1s linear infinite",
                border: "1.5px solid #d8cdb6",
                borderRadius: "50%",
                borderTopColor: "#6b6357",
                display: "inline-block",
                flexShrink: 0,
                height: "12px",
                width: "12px",
              }}
            >
              <span
                style={{
                  clip: "rect(0 0 0 0)",
                  clipPath: "inset(50%)",
                  height: "1px",
                  overflow: "hidden",
                  position: "absolute",
                  whiteSpace: "nowrap",
                  width: "1px",
                }}
              >
                Loading departments
              </span>
            </span>
          ) : (
            <ChevronIcon open={open} />
          )}
        </button>

        {open && (
          <div
            aria-label="Department list"
            onKeyDown={handleKeyDown}
            role="listbox"
            style={STYLES.dropdown}
          >
            <input
              aria-label="Search departments"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              ref={searchRef}
              style={STYLES.searchInput}
              type="search"
              value={search}
            />
            <div style={{ maxHeight: "240px", overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <p
                  style={{
                    color: "#9c9385",
                    fontSize: "13px",
                    padding: "10px 14px",
                  }}
                >
                  {search ? "No departments match" : "No departments available"}
                </p>
              ) : (
                filtered.map((item) => {
                  const isSelected = item.$id === value;
                  return (
                    <button
                      aria-selected={isSelected}
                      key={item.$id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={(event) => {
                        if (!isSelected) {
                          event.currentTarget.style.background = "#f3eee5";
                        }
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = isSelected
                          ? "rgba(26,24,20,0.06)"
                          : "transparent";
                      }}
                      role="option"
                      style={{
                        ...STYLES.listItem,
                        background: isSelected
                          ? "rgba(26,24,20,0.06)"
                          : "transparent",
                        border: 0,
                        width: "100%",
                      }}
                      type="button"
                    >
                      <span style={STYLES.crest}>
                        {item.Name.charAt(0).toUpperCase()}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        {item.Name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes dept-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
