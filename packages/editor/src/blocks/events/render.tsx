"use client";

import type { PatchFn } from "@/blocks/types";
import { usePageFeedSource } from "@/editor/page-feed-context";
import { pageFeedKey, resolveFeedDepartment } from "@/editor/page-feeds";
import type { EventItem, EventsBlock } from "@/editor/types";
import { useAutoFeed } from "@/editor/use-auto-feed";

interface Props {
  block: EventsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function EventsRender({ block, edit, onPatch }: Props) {
  const { department, locale } = usePageFeedSource();
  // "auto" → use page department; any other value → use as explicit table/dept ID
  const dept = resolveFeedDepartment(block.source, department);
  const isLive = !!dept;

  const { items: liveItems, loading } = useAutoFeed<EventItem>({
    enabled: isLive,
    key: pageFeedKey("events", dept, locale),
    url: `/api/pages/events?dept=${encodeURIComponent(dept)}&locale=${locale}`,
  });

  // A live block shows the feed or nothing — never `block.items`. Those are
  // the inspector's "Placeholder events", documented as "shown when no
  // department is set", so emitting them while a real feed loads is what put
  // demo content in front of visitors and crawlers.
  const items = isLive ? (liveItems ?? []) : block.items;
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
            {ev.going > 0 && (
              <div className="pg-event-card__foot">
                <b>{ev.going}</b> going
              </div>
            )}
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
