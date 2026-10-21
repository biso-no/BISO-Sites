"use client";

import { useDebounce } from "@repo/ui/hooks/use-debounce";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GroupDetails,
  getGroupById,
  listEventsWithGroups,
  listGroupsForEvent,
} from "@/app/(portal)/_actions/composer";
import { CAMPUS_ID_TO_NAME, CAMPUS_NAME_TO_ID } from "@/lib/campus-constants";
import { BRAND, fieldInputStyle } from "./ui";
import { useOutsideClick } from "./use-outside-click";

const SEARCH_DEBOUNCE_MS = 300;

interface EventOption {
  campusName: string;
  dateLabel: string;
  id: string;
  title: string;
}

interface GroupOption {
  campusId: string | null;
  id: string;
  memberCount: number;
  name: string;
}

interface GroupPickerProps {
  listEvents?: (query: string) => Promise<EventOption[]>;
  listGroups?: (eventId: string) => Promise<GroupOption[]>;
  onChange: (segmentId: string | null, campusId: string | null) => void;
  /** The segment id and the campus it belongs to (its own, else its event's). */
  resolveGroup?: (segmentId: string) => Promise<GroupDetails | null>;
  value: string | null;
}

function details(event: EventOption): string {
  return [event.dateLabel, event.campusName].filter(Boolean).join(" · ");
}

function peopleLabel(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

function EventCard({
  event,
  fallback = "",
  onChange,
}: {
  event: EventOption | null;
  fallback?: string;
  onChange: () => void;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        background: "white",
        border: `1px solid ${BRAND.rule2}`,
        borderRadius: 10,
        display: "flex",
        gap: 10,
        padding: "8px 10px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: BRAND.ink, fontSize: 13.5, fontWeight: 600 }}>
          {event?.title ?? fallback}
        </div>
        {event && (
          <div style={{ color: BRAND.ink3, fontSize: 12 }}>
            {details(event)}
          </div>
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

export function GroupPicker({
  listEvents = listEventsWithGroups,
  listGroups = listGroupsForEvent,
  onChange,
  resolveGroup = getGroupById,
  value,
}: GroupPickerProps) {
  const [event, setEvent] = useState<EventOption | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventStatus, setEventStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [groupStatus, setGroupStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [lookup, setLookup] = useState<"idle" | "loading" | "missing">("idle");
  const debouncedQuery = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setEventStatus("loading");
    listEvents(debouncedQuery)
      .then((rows) => {
        if (!cancelled) {
          setEvents(rows);
          setEventStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([]);
          setEventStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery, listEvents]);

  const eventId = event?.id ?? null;
  // A reopened draft, or a step that remounted, knows the group but not its event.
  useEffect(() => {
    if (!value || event) {
      setLookup("idle");
      return;
    }
    let cancelled = false;
    setLookup("loading");
    resolveGroup(value)
      .then((found) => {
        if (cancelled) {
          return;
        }
        if (!found) {
          setLookup("missing");
          return;
        }
        setEvent({
          campusName: CAMPUS_ID_TO_NAME[found.campusId ?? ""] ?? "",
          dateLabel: "",
          id: found.eventId,
          title: found.eventTitle,
        });
        setLookup("idle");
      })
      .catch(() => {
        if (!cancelled) {
          setLookup("missing");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value, event, resolveGroup]);

  useEffect(() => {
    if (!eventId) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    setGroupStatus("loading");
    listGroups(eventId)
      .then((rows) => {
        if (!cancelled) {
          setGroups(rows);
          setGroupStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGroups([]);
          setGroupStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, listGroups]);

  const closeDropdown = useCallback(() => setOpen(false), []);
  useOutsideClick(containerRef, open, closeDropdown);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function chooseEvent(next: EventOption) {
    setEvent(next);
    setOpen(false);
    setQuery("");
    onChange(null, null);
  }

  function changeEvent() {
    setEvent(null);
    setGroups([]);
    onChange(null, null);
    setOpen(true);
  }

  function chooseGroup(id: string) {
    const group = groups.find((item) => item.id === id);
    if (!(group && event)) {
      onChange(null, null);
      return;
    }
    const eventCampus = CAMPUS_NAME_TO_ID[event.campusName] ?? null;
    onChange(group.id, group.campusId ?? eventCampus);
  }

  // A reopened draft knows the group but not its event.
  if (!event && value) {
    return (
      <EventCard
        event={null}
        fallback={
          lookup === "missing"
            ? "This group is no longer available"
            : "Loading group…"
        }
        onChange={changeEvent}
      />
    );
  }

  let eventMessage: string | null = null;
  if (eventStatus === "loading" && events.length === 0) {
    eventMessage = "Searching…";
  } else if (eventStatus === "error") {
    eventMessage = "Couldn't load events. Try again.";
  } else if (events.length === 0) {
    eventMessage = "No events with groups";
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div ref={containerRef} style={{ position: "relative" }}>
        {event ? (
          <EventCard event={event} onChange={changeEvent} />
        ) : (
          <button
            aria-expanded={open}
            aria-haspopup="listbox"
            onClick={() => setOpen((previous) => !previous)}
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
            Choose event…
          </button>
        )}

        {open && !event && (
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
              aria-label="Search events"
              onChange={(input) => setQuery(input.target.value)}
              onKeyDown={(key) => {
                if (key.key === "Escape") {
                  setOpen(false);
                }
              }}
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
              type="text"
              value={query}
            />
            <div
              aria-label="Events with groups"
              role="listbox"
              style={{ maxHeight: 280, overflowY: "auto" }}
            >
              {eventMessage && (
                <p
                  style={{
                    color: BRAND.ink4,
                    fontSize: 13,
                    margin: 0,
                    padding: "10px 14px",
                  }}
                >
                  {eventMessage}
                </p>
              )}
              {events.map((item) => (
                <button
                  aria-selected={false}
                  key={item.id}
                  onClick={() => chooseEvent(item)}
                  role="option"
                  style={{
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    display: "block",
                    padding: "8px 14px",
                    textAlign: "left",
                    width: "100%",
                  }}
                  type="button"
                >
                  <span
                    style={{
                      color: BRAND.ink,
                      display: "block",
                      fontSize: 13.5,
                      fontWeight: 600,
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
                    {details(item)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {event && (
        <div>
          <select
            aria-label="Group"
            disabled={groupStatus === "loading" && groups.length === 0}
            onChange={(change) => chooseGroup(change.target.value)}
            style={fieldInputStyle()}
            value={value ?? ""}
          >
            <option value="">
              {groupStatus === "loading" && groups.length === 0
                ? "Loading groups…"
                : "Choose group…"}
            </option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({peopleLabel(group.memberCount)})
              </option>
            ))}
          </select>
          {groupStatus === "error" && (
            <p style={{ color: BRAND.red, fontSize: 12, margin: "6px 0 0" }}>
              Couldn't load groups. Try again.
            </p>
          )}
          {groupStatus === "idle" && groups.length === 0 && (
            <p style={{ color: BRAND.ink4, fontSize: 12, margin: "6px 0 0" }}>
              This event has no groups yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
