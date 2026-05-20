import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { CtaInspector } from "./inspector";
import { CtaRender } from "./render";

function CtaThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect fill={s} height="3" width="26" x="6" y="8" />
      <rect fill={s} height="6" rx="3" width="14" x="12" y="16" />
    </svg>
  );
}

registerBlock({
  type: "cta",
  label: "Big button",
  description: "One headline, one action",
  category: "Engage",
  variants: [
    { id: "card", label: "Card", kind: "card" },
    { id: "banner", label: "Banner", kind: "banner" },
    { id: "gradient", label: "Gradient", kind: "gradient" },
  ],
  aiHint: "A call-to-action section with a headline and a prominent button.",
  aiProps: ["title", "label", "url"],
  empty: () => emptyBlock("cta") as never,
  Render: CtaRender as never,
  Inspector: CtaInspector as never,
  PaletteThumb: CtaThumb,
});
