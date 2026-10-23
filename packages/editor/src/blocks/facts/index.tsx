import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { FactsInspector } from "./inspector";
import { FactsRender } from "./render";

function FactsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <line stroke={s} strokeWidth=".3" x1="6" x2="32" y1="7" y2="7" />
      <rect fill={s} height="1.5" opacity=".5" width="8" x="6" y="10" />
      <rect fill={s} height="1.5" opacity=".5" width="12" x="18" y="10" />
      <line stroke={s} strokeWidth=".3" x1="6" x2="32" y1="15" y2="15" />
      <rect fill={s} height="1.5" opacity=".5" width="8" x="6" y="18" />
      <rect fill={s} height="1.5" opacity=".5" width="10" x="18" y="18" />
      <line stroke={s} strokeWidth=".3" x1="6" x2="32" y1="23" y2="23" />
    </svg>
  );
}

registerBlock({
  type: "facts",
  label: "Facts",
  description: "Label and value rows",
  category: "Show people & numbers",
  aiHint: "A list of label and value rows, like when, where and price.",
  aiProps: ["items"],
  empty: () => emptyBlock("facts") as never,
  Render: FactsRender as never,
  Inspector: FactsInspector as never,
  PaletteThumb: FactsThumb,
  v2: true,
});
