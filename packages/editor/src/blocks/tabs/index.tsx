import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { TabsInspector } from "./inspector";
import { TabsRender } from "./render";
import { TabsThumb } from "./thumb";

registerBlock({
  type: "tabs",
  label: "Tabs",
  description: "Tabbed content panels",
  category: "Layout",
  group: "structure",
  aiHint: "Tabbed content with multiple panels.",
  aiProps: ["tabs"],
  empty: () => emptyBlock("tabs") as never,
  Render: TabsRender as never,
  Inspector: TabsInspector as never,
  PaletteThumb: TabsThumb,
  v2: true,
});
