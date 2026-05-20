import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { FeaturedCardsRender } from "./render";
import { FeaturedCardsInspector } from "./inspector";
import { FeaturedCardsThumb } from "./thumb";

registerBlock({
  type: "featuredCards",
  label: "Featured cards",
  description: "Accent-stripe feature cards",
  category: "Layout",
  aiHint: "Cards with a colored accent stripe, title, and body text.",
  aiProps: ["heading", "items"],
  empty: () => emptyBlock("featuredCards") as never,
  Render: FeaturedCardsRender as never,
  Inspector: FeaturedCardsInspector as never,
  PaletteThumb: FeaturedCardsThumb,
});
