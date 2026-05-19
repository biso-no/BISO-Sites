import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { TextRender } from "./render";
import { TextInspector } from "./inspector";

function TextThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="6" y="6" width="14" height="2.5" fill={s}/>
      <rect x="6" y="12" width="26" height="1.5" fill={s} opacity=".4"/>
      <rect x="6" y="15" width="22" height="1.5" fill={s} opacity=".4"/>
      <rect x="6" y="18" width="24" height="1.5" fill={s} opacity=".4"/>
      <rect x="6" y="21" width="18" height="1.5" fill={s} opacity=".4"/>
    </svg>
  );
}

registerBlock({
  type: "text",
  label: "Rich text",
  description: "Headings, paragraphs, bullets",
  category: "Tell a story",
  aiHint: "A rich-text block with headings and paragraphs.",
  aiProps: ["body"],
  empty: () => emptyBlock("text") as never,
  Render: TextRender as never,
  Inspector: TextInspector as never,
  PaletteThumb: TextThumb,
});
