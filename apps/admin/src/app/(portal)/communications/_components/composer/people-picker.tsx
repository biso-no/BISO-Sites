"use client";

import { useDebounce } from "@repo/ui/hooks/use-debounce";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPeopleByIds, searchPeople } from "@/app/(portal)/_actions/composer";
import type { PersonResult } from "@/lib/announcements/composer-lookups";
import { BRAND } from "./ui";
import { useOutsideClick } from "./use-outside-click";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const INITIALS_LENGTH = 2;
const WHITESPACE = /\s+/;

interface PeoplePickerProps {
  onChange: (ids: string[]) => void;
  resolve?: (ids: string[]) => Promise<PersonResult[]>;
  search?: (query: string) => Promise<PersonResult[]>;
  value: string[];
}

function initialsOf(name: string): string {
  return (
    name
      .split(WHITESPACE)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, INITIALS_LENGTH)
      .toUpperCase() || "?"
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      style={{
        alignItems: "center",
        background: BRAND.gold,
        borderRadius: 9,
        color: "white",
        display: "inline-flex",
        flexShrink: 0,
        fontSize: 10,
        height: 18,
        justifyContent: "center",
        width: 18,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

export function PeoplePicker({
  onChange,
  resolve = getPeopleByIds,
  search = searchPeople,
  value,
}: PeoplePickerProps) {
  const [known, setKnown] = useState<Record<string, PersonResult>>({});
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PersonResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const debouncedQuery = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);
  const containerRef = useRef<HTMLDivElement>(null);
  const asked = useRef(new Set<string>());
  // Ids whose lookup finished, found or not.
  const [settledIds, setSettledIds] = useState<Set<string>>(new Set());

  // Names for ids we have not seen yet, such as a reopened draft.
  useEffect(() => {
    const missing = value.filter((id) => !(known[id] || asked.current.has(id)));
    if (missing.length === 0) {
      return;
    }
    for (const id of missing) {
      asked.current.add(id);
    }
    const markSettled = () =>
      setSettledIds((previous) => new Set([...previous, ...missing]));
    resolve(missing)
      .then((people) => {
        setKnown((previous) => {
          const next = { ...previous };
          for (const person of people) {
            next[person.id] = person;
          }
          return next;
        });
        markSettled();
      })
      .catch(markSettled);
  }, [value, known, resolve]);

  const searchable = debouncedQuery.length >= MIN_QUERY_LENGTH;
  useEffect(() => {
    if (!searchable) {
      setResults([]);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    search(debouncedQuery)
      .then((people) => {
        if (!cancelled) {
          setResults(people);
          setStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, searchable, search]);

  const closeDropdown = useCallback(() => setOpen(false), []);
  useOutsideClick(containerRef, open, closeDropdown);

  function add(person: PersonResult) {
    setKnown((previous) => ({ ...previous, [person.id]: person }));
    asked.current.add(person.id);
    if (!value.includes(person.id)) {
      onChange([...value, person.id]);
    }
    setQuery("");
    setResults([]);
  }

  const typedEnough = query.trim().length >= MIN_QUERY_LENGTH;
  const visible = results.filter((person) => !value.includes(person.id));
  let message: string | null = null;
  if (!typedEnough) {
    message = "Type at least 2 letters to search.";
  } else if (status === "loading" && visible.length === 0) {
    message = "Searching…";
  } else if (status === "error") {
    message = "Couldn't load results. Try again.";
  } else if (visible.length === 0) {
    message = "No matches";
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        style={{
          alignItems: "center",
          background: "white",
          border: `0.5px solid ${BRAND.rule2}`,
          borderRadius: 8,
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          padding: "6px 8px",
        }}
      >
        {value.map((id) => {
          const person = known[id];
          const name =
            person?.name ??
            (settledIds.has(id) ? "Unknown person" : "Loading…");
          return (
            <span
              key={id}
              style={{
                alignItems: "center",
                background: BRAND.paper3,
                borderRadius: 999,
                display: "inline-flex",
                fontSize: 12,
                gap: 6,
                padding: "3px 4px 3px 4px",
              }}
            >
              <Avatar name={name} />
              {name}
              <button
                aria-label={`Remove ${name}`}
                onClick={() => onChange(value.filter((item) => item !== id))}
                style={{
                  alignItems: "center",
                  background: "transparent",
                  border: 0,
                  color: BRAND.ink3,
                  cursor: "pointer",
                  display: "inline-flex",
                  padding: 2,
                }}
                type="button"
              >
                <X aria-hidden size={12} />
              </button>
            </span>
          );
        })}
        <input
          aria-label="Search people"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={value.length === 0 ? "Search by name or email…" : "Add…"}
          style={{
            background: "transparent",
            border: 0,
            flex: 1,
            fontSize: 13.5,
            minWidth: 140,
            outline: 0,
            padding: "4px 4px",
          }}
          type="text"
          value={query}
        />
      </div>

      {open && (
        <div
          aria-label="Matching people"
          role="listbox"
          style={{
            background: "white",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            left: 0,
            maxHeight: 320,
            overflowY: "auto",
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 50,
          }}
        >
          {message && (
            <p
              style={{
                color: BRAND.ink4,
                fontSize: 13,
                margin: 0,
                padding: "10px 14px",
              }}
            >
              {message}
            </p>
          )}
          {visible.map((person) => (
            <button
              aria-selected={false}
              key={person.id}
              onClick={() => add(person)}
              role="option"
              style={{
                alignItems: "center",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                display: "flex",
                gap: 10,
                padding: "8px 14px",
                textAlign: "left",
                width: "100%",
              }}
              type="button"
            >
              <Avatar name={person.name} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    color: BRAND.ink,
                    display: "block",
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  {person.name}
                </span>
                <span
                  style={{ color: BRAND.ink3, display: "block", fontSize: 12 }}
                >
                  {[person.email, person.campusName]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
