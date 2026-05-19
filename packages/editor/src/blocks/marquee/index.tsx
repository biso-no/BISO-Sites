import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { MarqueeRender } from "./render";
import { MarqueeInspector } from "./inspector";

function MarqueeThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="3" y="12" width="6" height="2" fill={s} rx="1"/>
      <rect x="11" y="12" width="6" height="2" fill={s} rx="1" opacity=".6"/>
      <rect x="19" y="12" width="6" height="2" fill={s} rx="1"/>
      <rect x="27" y="12" width="6" height="2" fill={s} rx="1" opacity=".6"/>
    </svg>
  );
}

registerBlock({
  type: "marquee",
  label: "Marquee",
  description: "Scrolling text strip",
  category: "Top of page",
  aiHint: "A horizontal scrolling text strip, great for taglines or keywords.",
  aiProps: ["text"],
  empty: () => emptyBlock("marquee") as never,
  Render: MarqueeRender as never,
  Inspector: MarqueeInspector as never,
  PaletteThumb: MarqueeThumb,
});
