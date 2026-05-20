import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { EventsInspector } from "./inspector";
import { EventsRender } from "./render";

function EventsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect fill={s} height="3" width="10" x={3 + i * 11} y="7" />
          <rect
            fill={s}
            height="12"
            opacity=".15"
            width="10"
            x={3 + i * 11}
            y="11"
          />
        </g>
      ))}
    </svg>
  );
}

registerBlock({
  type: "events",
  label: "Events feed",
  description: "Auto-updates from your dept",
  category: "Pull from BISO",
  aiHint:
    "A grid of upcoming events. Set source to an Appwrite collection ID to bind live data.",
  aiProps: ["heading", "source", "items"],
  empty: () => emptyBlock("events") as never,
  Render: EventsRender as never,
  Inspector: EventsInspector as never,
  PaletteThumb: EventsThumb,
});
