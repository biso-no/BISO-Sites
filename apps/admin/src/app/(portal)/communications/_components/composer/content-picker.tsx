"use client";

import { useDebounce } from "@repo/ui/hooks/use-debounce";
import { Search } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { searchLinkableContent } from "@/app/(portal)/_actions/composer";
import type { LinkableItem } from "@/lib/announcements/composer-lookups";
import type { ComposerLinkType } from "./composer-state";
import type { LinkedDisplay } from "./link-state";
import { BRAND } from "./ui";

const SEARCH_DEBOUNCE_MS = 300;

const PLURAL: Record<ComposerLinkType, string> = {
  event: "events",
  job: "positions",
  news: "articles",
};

type SearchFn = (
  type: ComposerLinkType,
  query: string
) => Promise<LinkableItem[]>;

interface ContentPickerProps {
  onClear: () => void;
  onPick: (item: LinkableItem) => void;
  search?: SearchFn;
  type: ComposerLinkType;
  value: LinkedDisplay | null;
}

function Thumb({
  height,
  image,
  width,
}: {
  height: number;
  image: string | null;
  width: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        background: BRAND.paper3,
        borderRadius: 8,
        flexShrink: 0,
        height,
        overflow: "hidden",
        position: "relative",
        width,
      }}
    >
      {image ? (
        <Image
          alt=""
          fill
          sizes={`${width}px`}
          src={image}
          style={{ objectFit: "cover" }}
          unoptimized
        />
      ) : null}
    </span>
  );
}

function rowDetails(item: LinkableItem): string {
  const status = item.linkable ? "Published" : "Draft (can't link drafts)";
  return [item.dateLabel, item.campusName, status].filter(Boolean).join(" · ");
}

function LinkedCard({
  onChange,
  value,
}: {
  onChange: () => void;
  value: LinkedDisplay;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        background: "white",
        border: `1px solid ${BRAND.rule2}`,
        borderRadius: 12,
        display: "flex",
        gap: 12,
        padding: 10,
      }}
    >
      <Thumb height={48} image={value.image} width={64} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: BRAND.ink,
            fontSize: 14,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value.title}
        </div>
        {value.meta && (
          <div style={{ color: BRAND.ink3, fontSize: 12 }}>{value.meta}</div>
        )}
      </div>
      <button
        onClick={onChange}
        style={{
          background: "transparent",
          border: 0,
          color: BRAND.bisoBlue,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          padding: "6px 8px",
        }}
        type="button"
      >
        Change
      </button>
    </div>
  );
}

export function ContentPicker({
  onClear,
  onPick,
  search = searchLinkableContent,
  type,
  value,
}: ContentPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LinkableItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search whenever the dropdown is open and the typed text settles. An empty
  // query returns the newest items, so the list is useful before typing.
  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setStatus("loading");
    search(type, debouncedQuery)
      .then((rows) => {
        if (!cancelled) {
          setItems(rows);
          setStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery, search, type]);

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
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  if (value) {
    return (
      <LinkedCard
        onChange={() => {
          onClear();
          setQuery("");
          setOpen(true);
        }}
        value={value}
      />
    );
  }

  function pick(item: LinkableItem) {
    if (!item.linkable) {
      return;
    }
    setOpen(false);
    setQuery("");
    onPick(item);
  }

  function closeOnEscape(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  let emptyMessage: string | null = null;
  if (status === "loading" && items.length === 0) {
    emptyMessage = "Searching…";
  } else if (status === "error") {
    emptyMessage = "Couldn't load results. Try again.";
  } else if (items.length === 0) {
    emptyMessage = "No matches";
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={closeOnEscape}
        style={{
          alignItems: "center",
          background: "rgba(255,255,255,.6)",
          border: `0.5px solid ${BRAND.rule2}`,
          borderRadius: 8,
          color: BRAND.ink4,
          cursor: "pointer",
          display: "flex",
          fontSize: 14,
          gap: 8,
          padding: "10px 12px",
          textAlign: "left",
          width: "100%",
        }}
        type="button"
      >
        <Search aria-hidden color={BRAND.ink4} size={14} />
        Search by name…
      </button>

      {open && (
        <div
          style={{
            background: "white",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            left: 0,
            overflow: "hidden",
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 50,
          }}
        >
          <input
            aria-label={`Search ${PLURAL[type]}`}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={closeOnEscape}
            placeholder="Search by name…"
            ref={inputRef}
            style={{
              background: "transparent",
              border: 0,
              borderBottom: `0.5px solid ${BRAND.rule}`,
              fontSize: 13.5,
              outline: 0,
              padding: "10px 14px",
              width: "100%",
            }}
            type="search"
            value={query}
          />
          <div
            aria-label={`Matching ${PLURAL[type]}`}
            role="listbox"
            style={{ maxHeight: 320, overflowY: "auto" }}
          >
            {emptyMessage && (
              <p
                style={{
                  color: BRAND.ink4,
                  fontSize: 13,
                  margin: 0,
                  padding: "10px 14px",
                }}
              >
                {emptyMessage}
              </p>
            )}
            {items.map((item) => (
              <button
                aria-disabled={!item.linkable}
                aria-selected={false}
                disabled={!item.linkable}
                key={item.id}
                onClick={() => pick(item)}
                role="option"
                style={{
                  alignItems: "center",
                  background: "transparent",
                  border: 0,
                  cursor: item.linkable ? "pointer" : "not-allowed",
                  display: "flex",
                  gap: 10,
                  opacity: item.linkable ? 1 : 0.55,
                  padding: "8px 14px",
                  textAlign: "left",
                  width: "100%",
                }}
                type="button"
              >
                <Thumb height={36} image={item.image} width={36} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      color: BRAND.ink,
                      display: "block",
                      fontSize: 13.5,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title}
                  </span>
                  <span
                    style={{
                      color: BRAND.ink3,
                      display: "block",
                      fontSize: 12,
                    }}
                  >
                    {rowDetails(item)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
