import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { MarqueeInspector } from "./inspector";
import { MarqueeRender } from "./render";

function MarqueeThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect fill={s} height="2" rx="1" width="6" x="3" y="12" />
      <rect fill={s} height="2" opacity=".6" rx="1" width="6" x="11" y="12" />
      <rect fill={s} height="2" rx="1" width="6" x="19" y="12" />
      <rect fill={s} height="2" opacity=".6" rx="1" width="6" x="27" y="12" />
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
