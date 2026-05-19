import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { CtaRender } from "./render";
import { CtaInspector } from "./inspector";

function CtaThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="6"  y="8"  width="26" height="3" fill={s}/>
      <rect x="12" y="16" width="14" height="6" rx="3" fill={s}/>
    </svg>
  );
}

registerBlock({
  type: "cta",
  label: "Big button",
  description: "One headline, one action",
  category: "Engage",
  aiHint: "A call-to-action section with a headline and a prominent button.",
  aiProps: ["title", "label", "url"],
  empty: () => emptyBlock("cta") as never,
  Render: CtaRender as never,
  Inspector: CtaInspector as never,
  PaletteThumb: CtaThumb,
});
