import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { LinkTileGridInspector } from "./inspector";
import { LinkTileGridRender } from "./render";
import { LinkTileGridThumb } from "./thumb";

registerBlock({
  type: "linkTileGrid",
  label: "Link tiles",
  description: "Navigation tile grid",
  category: "Layout",
  aiHint: "A grid of icon tiles that link to sub-pages.",
  aiProps: ["heading", "items"],
  empty: () => emptyBlock("linkTileGrid") as never,
  Render: LinkTileGridRender as never,
  Inspector: LinkTileGridInspector as never,
  PaletteThumb: LinkTileGridThumb,
});
