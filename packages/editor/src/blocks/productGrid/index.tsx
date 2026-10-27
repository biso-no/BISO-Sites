import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { ProductGridInspector } from "./inspector";
import { ProductGridRender } from "./render";
import { ProductGridThumb } from "./thumb";

registerBlock({
  type: "productGrid",
  label: "Shop",
  description: "A department's products",
  category: "Pull from BISO",
  group: "live",
  aiHint:
    "A grid of a department's shop products. Set source to auto (the page department) or a department id; limit is 4 or 8.",
  aiProps: ["heading", "source", "limit"],
  empty: () => emptyBlock("productGrid") as never,
  Render: ProductGridRender as never,
  Inspector: ProductGridInspector as never,
  PaletteThumb: ProductGridThumb,
});
