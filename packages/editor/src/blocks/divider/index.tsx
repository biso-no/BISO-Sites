import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { DividerInspector } from "./inspector";
import { DividerRender } from "./render";

function DividerThumb() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <line
        stroke="var(--ink-3)"
        strokeWidth=".6"
        x1="5"
        x2="33"
        y1="15"
        y2="15"
      />
    </svg>
  );
}

registerBlock({
  type: "divider",
  label: "Divider",
  description: "A line between sections",
  category: "Show people & numbers",
  aiHint: "A horizontal rule with small, medium or large spacing.",
  aiProps: ["spacing"],
  empty: () => emptyBlock("divider") as never,
  Render: DividerRender as never,
  Inspector: DividerInspector as never,
  PaletteThumb: DividerThumb,
  v2: true,
});
