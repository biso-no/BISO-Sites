import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { HighlightsInspector } from "./inspector";
import { HighlightsRender } from "./render";

function HighlightsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect fill={s} height="5" width="1" x="8" y="7" />
      <rect fill={s} height="1.5" opacity=".5" width="20" x="12" y="9" />
      <rect fill={s} height="5" width="1" x="8" y="15" />
      <rect fill={s} height="1.5" opacity=".5" width="16" x="12" y="17" />
      <rect fill={s} height="5" width="1" x="8" y="23" />
      <rect fill={s} height="1.5" opacity=".5" width="18" x="12" y="25" />
    </svg>
  );
}

registerBlock({
  type: "highlights",
  label: "Highlights",
  description: "Short points with an accent rule",
  category: "Show people & numbers",
  group: "text",
  aiHint: "A short list of highlighted points, each with an accent rule.",
  aiProps: ["items"],
  empty: () => emptyBlock("highlights") as never,
  Render: HighlightsRender as never,
  Inspector: HighlightsInspector as never,
  PaletteThumb: HighlightsThumb,
});
