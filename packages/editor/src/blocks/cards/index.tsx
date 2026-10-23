import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { CardsInspector } from "./inspector";
import { CardsRender } from "./render";

function CardsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      {[2, 14, 26].map((x) => (
        <g key={x}>
          <rect
            fill="none"
            height="18"
            rx="1.5"
            stroke={s}
            strokeWidth=".5"
            width="10"
            x={x}
            y="6"
          />
          <rect fill={s} height="1.5" opacity=".5" width="6" x={x + 2} y="10" />
          <rect fill={s} height="1" opacity=".35" width="6" x={x + 2} y="14" />
          <rect fill={s} height="1" opacity=".35" width="4" x={x + 2} y="17" />
        </g>
      ))}
    </svg>
  );
}

registerBlock({
  type: "cards",
  label: "Cards",
  description: "A grid or scrolling row of cards, each can link",
  category: "Layout",
  group: "structure",
  aiHint:
    "Cards with title, body, optional eyebrow, image and link, as a grid or a scrolling row.",
  aiProps: ["columns", "layout", "style", "items"],
  empty: () => emptyBlock("cards") as never,
  Render: CardsRender as never,
  Inspector: CardsInspector as never,
  PaletteThumb: CardsThumb,
  v2: true,
});
