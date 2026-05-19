import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { TeamRender } from "./render";
import { TeamInspector } from "./inspector";

function TeamThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={8 + i * 11} cy="13" r="3" fill={s} opacity=".5"/>
          <rect x={3 + i * 11} y="19" width="10" height="1.5" fill={s} opacity=".4"/>
          <rect x={5 + i * 11} y="22" width="6" height="1.5" fill={s} opacity=".3"/>
        </g>
      ))}
    </svg>
  );
}

registerBlock({
  type: "team",
  label: "Team grid",
  description: "Officers, board, members",
  category: "Show people & numbers",
  aiHint: "A grid of team members with avatars, names, and roles.",
  aiProps: ["heading", "members"],
  empty: () => emptyBlock("team") as never,
  Render: TeamRender as never,
  Inspector: TeamInspector as never,
  PaletteThumb: TeamThumb,
});
