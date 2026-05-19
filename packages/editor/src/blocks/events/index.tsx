import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { EventsRender } from "./render";
import { EventsInspector } from "./inspector";

function EventsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={3 + i * 11} y="7" width="10" height="3" fill={s}/>
          <rect x={3 + i * 11} y="11" width="10" height="12" fill={s} opacity=".15"/>
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
  aiHint: "A grid of upcoming events. Set source to an Appwrite collection ID to bind live data.",
  aiProps: ["heading", "source", "items"],
  empty: () => emptyBlock("events") as never,
  Render: EventsRender as never,
  Inspector: EventsInspector as never,
  PaletteThumb: EventsThumb,
});
