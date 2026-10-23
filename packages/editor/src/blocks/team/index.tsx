import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { TeamInspector } from "./inspector";
import { TeamRender } from "./render";

function TeamThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={8 + i * 11} cy="13" fill={s} opacity=".5" r="3" />
          <rect
            fill={s}
            height="1.5"
            opacity=".4"
            width="10"
            x={3 + i * 11}
            y="19"
          />
          <rect
            fill={s}
            height="1.5"
            opacity=".3"
            width="6"
            x={5 + i * 11}
            y="22"
          />
        </g>
      ))}
    </svg>
  );
}

registerBlock({
  type: "team",
  label: "Team grid",
  description: "People with photos, typed in or from the board",
  category: "Show people & numbers",
  group: "people",
  aiHint:
    "A grid of people cards. source manual uses members [{ name, role, email?, phone?, photo?: { src } }]; source board shows the page department's live board. showContact controls email and phone links.",
  aiProps: ["heading", "source", "showContact", "members"],
  empty: () => emptyBlock("team") as never,
  Render: TeamRender as never,
  Inspector: TeamInspector as never,
  PaletteThumb: TeamThumb,
});
