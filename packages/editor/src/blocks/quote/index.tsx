import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { QuoteInspector } from "./inspector";
import { QuoteRender } from "./render";

function QuoteThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <text
        fill={s}
        fontFamily="serif"
        fontSize="16"
        fontStyle="italic"
        x="5"
        y="17"
      >
        "
      </text>
      <rect fill={s} height="1.5" opacity=".5" width="20" x="11" y="11" />
      <rect fill={s} height="1.5" opacity=".5" width="22" x="11" y="15" />
      <rect fill={s} height="1.5" opacity=".5" width="13" x="11" y="19" />
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
