import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { PartnersRender } from "./render";
import { PartnersInspector } from "./inspector";
import { PartnersThumb } from "./thumb";

registerBlock({
  type: "partners",
  label: "Partners",
  description: "Logo grid from Appwrite",
  category: "Data",
  aiHint: "A grid of partner/sponsor logos.",
  aiProps: ["heading"],
  empty: () => emptyBlock("partners") as never,
  Render: PartnersRender as never,
  Inspector: PartnersInspector as never,
  PaletteThumb: PartnersThumb,
});
