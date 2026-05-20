import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { TextInspector } from "./inspector";
import { TextRender } from "./render";

function TextThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect fill={s} height="2.5" width="14" x="6" y="6" />
      <rect fill={s} height="1.5" opacity=".4" width="26" x="6" y="12" />
      <rect fill={s} height="1.5" opacity=".4" width="22" x="6" y="15" />
      <rect fill={s} height="1.5" opacity=".4" width="24" x="6" y="18" />
      <rect fill={s} height="1.5" opacity=".4" width="18" x="6" y="21" />
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
