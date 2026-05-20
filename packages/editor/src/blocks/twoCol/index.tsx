import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { TwoColRender } from "./render";
import { TwoColInspector } from "./inspector";

function TwoColThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="3" y="6" width="14" height="18" rx="2" stroke={s} strokeWidth=".5" fill="none"/>
      <rect x="21" y="6" width="14" height="18" rx="2" stroke={s} strokeWidth=".5" fill="none"/>
      <rect x="5" y="9" width="10" height="1.5" fill={s} opacity=".5"/>
      <rect x="5" y="12" width="8" height="1.5" fill={s} opacity=".3"/>
      <rect x="23" y="9" width="10" height="1.5" fill={s} opacity=".5"/>
      <rect x="23" y="12" width="7" height="1.5" fill={s} opacity=".3"/>
    </svg>
  );
}

registerBlock({
  type: "twoCol",
  label: "Two columns",
  description: "Side-by-side text blocks",
  category: "Tell a story",
  variants: [
    { id: "equal",     label: "50 / 50",  kind: "equal" },
    { id: "leftWide",  label: "66 / 33",  kind: "leftWide" },
    { id: "rightWide", label: "33 / 66",  kind: "rightWide" },
  ],
  aiHint: "Two columns of text side by side.",
  aiProps: ["left", "right"],
  empty: () => emptyBlock("twoCol") as never,
  Render: TwoColRender as never,
  Inspector: TwoColInspector as never,
  PaletteThumb: TwoColThumb,
});
