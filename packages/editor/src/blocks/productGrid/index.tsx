import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { ProductGridInspector } from "./inspector";
import { ProductGridRender } from "./render";
import { ProductGridThumb } from "./thumb";

registerBlock({
  type: "productGrid",
  label: "Products",
  description: "Shop product grid",
  category: "Data",
  aiHint: "A grid of products from the shop, optionally filtered by tag.",
  aiProps: ["heading", "tag"],
  empty: () => emptyBlock("productGrid") as never,
  Render: ProductGridRender as never,
  Inspector: ProductGridInspector as never,
  PaletteThumb: ProductGridThumb,
});
