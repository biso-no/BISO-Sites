import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { StatsRender } from "./render";
import { StatsInspector } from "./inspector";

function StatsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <line x1="11.5" y1="6" x2="11.5" y2="24" stroke={s} strokeWidth=".3"/>
      <line x1="20"   y1="6" x2="20"   y2="24" stroke={s} strokeWidth=".3"/>
      <line x1="28.5" y1="6" x2="28.5" y2="24" stroke={s} strokeWidth=".3"/>
      <text x="6"  y="16" fontSize="6" fill={s} fontFamily="serif">12</text>
      <text x="14" y="16" fontSize="6" fill={s} fontFamily="serif">48</text>
      <text x="23" y="16" fontSize="6" fill={s} fontFamily="serif">91</text>
    </svg>
  );
}

registerBlock({
  type: "stats",
  label: "Big numbers",
  description: "Three or four metrics in a row",
  category: "Show people & numbers",
  aiHint: "A row of large numeric statistics with labels underneath.",
  aiProps: ["items"],
  empty: () => emptyBlock("stats") as never,
  Render: StatsRender as never,
  Inspector: StatsInspector as never,
  PaletteThumb: StatsThumb,
});
