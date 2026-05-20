import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { FaqInspector } from "./inspector";
import { FaqRender } from "./render";

function FaqThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <line
        opacity=".4"
        stroke={s}
        strokeWidth=".3"
        x1="4"
        x2="34"
        y1="9"
        y2="9"
      />
      <circle cx="6" cy="14" fill={s} r="1" />
      <rect fill={s} height="2" width="18" x="9" y="13" />
      <line
        opacity=".4"
        stroke={s}
        strokeWidth=".3"
        x1="4"
        x2="34"
        y1="19"
        y2="19"
      />
      <circle cx="6" cy="23" fill={s} r="1" />
      <rect fill={s} height="2" opacity=".5" width="14" x="9" y="22" />
    </svg>
  );
}

registerBlock({
  type: "faq",
  label: "FAQ",
  description: "Expandable questions",
  category: "Engage",
  variants: [
    { id: "list", label: "List", kind: "list" },
    { id: "accordion-themed", label: "Themed", kind: "accordion-themed" },
  ],
  aiHint: "Frequently asked questions with answers.",
  aiProps: ["heading", "items"],
  empty: () => emptyBlock("faq") as never,
  Render: FaqRender as never,
  Inspector: FaqInspector as never,
  PaletteThumb: FaqThumb,
});
