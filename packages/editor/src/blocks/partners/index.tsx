import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { PartnersInspector } from "./inspector";
import { PartnersRender } from "./render";
import { PartnersThumb } from "./thumb";

registerBlock({
  type: "partners",
  label: "Partners",
  description: "Logo grid, from the partner list or your own",
  category: "Pull from BISO",
  group: "live",
  aiHint:
    "A grid of partner logos. source auto shows BISO's national partners; manual uses items [{ name, logo: { src }, href }].",
  aiProps: ["heading", "source", "items"],
  empty: () => emptyBlock("partners") as never,
  Render: PartnersRender as never,
  Inspector: PartnersInspector as never,
  PaletteThumb: PartnersThumb,
  v2: true,
});
