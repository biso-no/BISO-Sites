import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { TwoColInspector } from "./inspector";
import { TwoColRender } from "./render";

function TwoColThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect
        fill="none"
        height="18"
        rx="2"
        stroke={s}
        strokeWidth=".5"
        width="14"
        x="3"
        y="6"
      />
      <rect
        fill="none"
        height="18"
        rx="2"
        stroke={s}
        strokeWidth=".5"
        width="14"
        x="21"
        y="6"
      />
      <rect fill={s} height="1.5" opacity=".5" width="10" x="5" y="9" />
      <rect fill={s} height="1.5" opacity=".3" width="8" x="5" y="12" />
      <rect fill={s} height="1.5" opacity=".5" width="10" x="23" y="9" />
      <rect fill={s} height="1.5" opacity=".3" width="7" x="23" y="12" />
    </svg>
  );
}

registerBlock({
  type: "twoCol",
  label: "Two columns",
  description: "Side-by-side text blocks",
  category: "Tell a story",
  variants: [
    { id: "equal", label: "50 / 50", kind: "equal" },
    { id: "leftWide", label: "66 / 33", kind: "leftWide" },
    { id: "rightWide", label: "33 / 66", kind: "rightWide" },
  ],
  aiHint: "Two columns of text side by side.",
  aiProps: ["left", "right"],
  empty: () => emptyBlock("twoCol") as never,
  Render: TwoColRender as never,
  Inspector: TwoColInspector as never,
  PaletteThumb: TwoColThumb,
});
