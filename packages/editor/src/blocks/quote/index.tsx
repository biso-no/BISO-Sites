import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { QuoteRender } from "./render";
import { QuoteInspector } from "./inspector";

function QuoteThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <text x="5" y="17" fontSize="16" fill={s} fontFamily="serif" fontStyle="italic">"</text>
      <rect x="11" y="11" width="20" height="1.5" fill={s} opacity=".5"/>
      <rect x="11" y="15" width="22" height="1.5" fill={s} opacity=".5"/>
      <rect x="11" y="19" width="13" height="1.5" fill={s} opacity=".5"/>
    </svg>
  );
}

registerBlock({
  type: "quote",
  label: "Pull quote",
  description: "A line worth standing on its own",
  category: "Tell a story",
  aiHint: "A featured pull quote with attribution.",
  aiProps: ["text", "author", "role"],
  empty: () => emptyBlock("quote") as never,
  Render: QuoteRender as never,
  Inspector: QuoteInspector as never,
  PaletteThumb: QuoteThumb,
});
