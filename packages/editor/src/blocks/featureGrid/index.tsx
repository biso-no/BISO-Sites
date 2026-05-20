import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { FeatureGridRender } from "./render";
import { FeatureGridInspector } from "./inspector";
import { FeatureGridThumb } from "./thumb";

registerBlock({
  type: "featureGrid",
  label: "Feature grid",
  description: "Icon cards in a grid",
  category: "Layout",
  variants: [
    { id: "bordered", label: "Bordered", kind: "bordered" },
    { id: "cards",    label: "Cards",    kind: "cards" },
    { id: "minimal",  label: "Minimal",  kind: "minimal" },
  ],
  aiHint: "A grid of icon cards each with a title and body text.",
  aiProps: ["heading", "intro", "items"],
  empty: () => emptyBlock("featureGrid") as never,
  Render: FeatureGridRender as never,
  Inspector: FeatureGridInspector as never,
  PaletteThumb: FeatureGridThumb,
});
