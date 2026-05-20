import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { FaqRender } from "./render";
import { FaqInspector } from "./inspector";

function FaqThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <line x1="4" y1="9" x2="34" y2="9" stroke={s} opacity=".4" strokeWidth=".3"/>
      <circle cx="6" cy="14" r="1" fill={s}/>
      <rect x="9" y="13" width="18" height="2" fill={s}/>
      <line x1="4" y1="19" x2="34" y2="19" stroke={s} opacity=".4" strokeWidth=".3"/>
      <circle cx="6" cy="23" r="1" fill={s}/>
      <rect x="9" y="22" width="14" height="2" fill={s} opacity=".5"/>
    </svg>
  );
}

registerBlock({
  type: "faq",
  label: "FAQ",
  description: "Expandable questions",
  category: "Engage",
  variants: [
    { id: "list",             label: "List",   kind: "list" },
    { id: "accordion-themed", label: "Themed", kind: "accordion-themed" },
  ],
  aiHint: "Frequently asked questions with answers.",
  aiProps: ["heading", "items"],
  empty: () => emptyBlock("faq") as never,
  Render: FaqRender as never,
  Inspector: FaqInspector as never,
  PaletteThumb: FaqThumb,
});
