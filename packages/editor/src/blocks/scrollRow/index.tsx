import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { ScrollRowRender } from "./render";
import { ScrollRowInspector } from "./inspector";
import { ScrollRowThumb } from "./thumb";

registerBlock({
  type: "scrollRow",
  label: "Scroll row",
  description: "Horizontal scrollable cards",
  category: "Layout",
  aiHint: "A horizontally scrollable row of benefit or feature cards.",
  aiProps: ["heading", "items"],
  empty: () => emptyBlock("scrollRow") as never,
  Render: ScrollRowRender as never,
  Inspector: ScrollRowInspector as never,
  PaletteThumb: ScrollRowThumb,
});
