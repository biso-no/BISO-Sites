"use client";

import { useEffect, useState } from "react";
import type { PatchFn } from "@/blocks/types";
import { useEditorStore } from "@/editor/store";
import type { EventItem, EventsBlock } from "@/editor/types";

interface Props {
  block: EventsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function EventsRender({ block, edit, onPatch }: Props) {
  const department = useEditorStore((s) => s.doc.meta.department);
  const [liveItems, setLiveItems] = useState<EventItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  // "auto" → use page department; any other value → use as explicit table/dept ID
  const source = block.source || "auto";
  const dept = source === "auto" ? department : source;
  const isLive = !!dept;

  useEffect(() => {
    if (!dept) {
      setLiveItems(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/pages/events?dept=${encodeURIComponent(dept)}`)
      .then((r) => r.json())
      .then((data: EventItem[]) => {
        if (!cancelled) {
          setLiveItems(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveItems(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dept]);

  const items = (isLive ? liveItems : null) ?? block.items;
  let emptyMessage = "Set a department to load live events.";
  if (loading) {
    emptyMessage = "Loading…";
  } else if (isLive) {
    emptyMessage = "No upcoming events.";
  }

  return (
    <div className="pg-events pg-block">
      <div className="pg-events-hd">
        {edit ? (
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: contentEditable and editor preview controls intentionally use custom interaction surfaces.
          <h2
            contentEditable
            data-edit="1"
            onBlur={(e) =>
              onPatch("heading", e.currentTarget.textContent ?? "")
            }
            suppressContentEditableWarning
          >
            {block.heading}
          </h2>
        ) : (
          <h2>{block.heading}</h2>
        )}
        {isLive && (
          <div className="pg-events__live-feed">
            <i aria-hidden="true" />
            {loading ? "Loading…" : "Live feed"}
          </div>
        )}
      </div>
      <div className="pg-events-grid">
        {items.map((ev, i) => (
          <div className="pg-event-card" key={i}>
            <div className="pg-event-card__date-stripe">
              <span>{ev.date}</span>
              {isLive && <span className="syn">live</span>}
            </div>
            <div className="pg-event-card__body">
              <div className="pg-event-card__title">{ev.title}</div>
              <div className="pg-event-card__where">{ev.where}</div>
            </div>
            <div className="pg-event-card__foot">
              <b>{ev.going}</b> going
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p
            style={{ fontSize: 13, color: "var(--ink-3)", gridColumn: "1/-1" }}
          >
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  );
}
