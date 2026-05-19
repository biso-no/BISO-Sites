import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { TimelineRender } from "./render";
import { TimelineInspector } from "./inspector";

function TimelineThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <line x1="10" y1="4" x2="10" y2="26" stroke={s} strokeWidth=".5" opacity=".5"/>
      <circle cx="10" cy="9" r="2" fill={s} opacity=".5"/>
      <rect x="14" y="8" width="18" height="2" fill={s} opacity=".4"/>
      <circle cx="10" cy="17" r="2" fill={s} opacity=".5"/>
      <rect x="14" y="16" width="12" height="2" fill={s} opacity=".4"/>
      <circle cx="10" cy="24" r="2" fill={s} opacity=".3"/>
      <rect x="14" y="23" width="15" height="2" fill={s} opacity=".3"/>
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
