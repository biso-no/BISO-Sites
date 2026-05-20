import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { TimelineInspector } from "./inspector";
import { TimelineRender } from "./render";

function TimelineThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <line
        opacity=".5"
        stroke={s}
        strokeWidth=".5"
        x1="10"
        x2="10"
        y1="4"
        y2="26"
      />
      <circle cx="10" cy="9" fill={s} opacity=".5" r="2" />
      <rect fill={s} height="2" opacity=".4" width="18" x="14" y="8" />
      <circle cx="10" cy="17" fill={s} opacity=".5" r="2" />
      <rect fill={s} height="2" opacity=".4" width="12" x="14" y="16" />
      <circle cx="10" cy="24" fill={s} opacity=".3" r="2" />
      <rect fill={s} height="2" opacity=".3" width="15" x="14" y="23" />
    </svg>
  );
}

registerBlock({
  type: "timeline",
  label: "Timeline",
  description: "Year-by-year milestones",
  category: "Show people & numbers",
  aiHint: "A chronological list of milestones with year and description.",
  aiProps: ["heading", "items"],
  empty: () => emptyBlock("timeline") as never,
  Render: TimelineRender as never,
  Inspector: TimelineInspector as never,
  PaletteThumb: TimelineThumb,
});
