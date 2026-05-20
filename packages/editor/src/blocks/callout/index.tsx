import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { CalloutInspector } from "./inspector";
import { CalloutRender } from "./render";

function CalloutThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect
        fill="none"
        height="12"
        rx="1.5"
        stroke={s}
        strokeDasharray="2 1.5"
        strokeWidth=".5"
        width="32"
        x="3"
        y="9"
      />
      <circle cx="8" cy="15" fill="var(--gold)" r="2" />
      <rect fill={s} height="1.5" width="14" x="13" y="14" />
    </svg>
  );
}

registerBlock({
  type: "callout",
  label: "Callout",
  description: "An info box with an icon",
  category: "Tell a story",
  aiHint: "A highlighted info or warning box.",
  aiProps: ["title", "body"],
  empty: () => emptyBlock("callout") as never,
  Render: CalloutRender as never,
  Inspector: CalloutInspector as never,
  PaletteThumb: CalloutThumb,
});
