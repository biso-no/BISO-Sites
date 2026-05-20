import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { StatsInspector } from "./inspector";
import { StatsRender } from "./render";

function StatsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <line stroke={s} strokeWidth=".3" x1="11.5" x2="11.5" y1="6" y2="24" />
      <line stroke={s} strokeWidth=".3" x1="20" x2="20" y1="6" y2="24" />
      <line stroke={s} strokeWidth=".3" x1="28.5" x2="28.5" y1="6" y2="24" />
      <text fill={s} fontFamily="serif" fontSize="6" x="6" y="16">
        12
      </text>
      <text fill={s} fontFamily="serif" fontSize="6" x="14" y="16">
        48
      </text>
      <text fill={s} fontFamily="serif" fontSize="6" x="23" y="16">
        91
      </text>
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
