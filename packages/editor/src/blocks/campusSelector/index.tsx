import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { CampusSelectorInspector } from "./inspector";
import { CampusSelectorRender } from "./render";
import { CampusSelectorThumb } from "./thumb";

registerBlock({
  type: "campusSelector",
  label: "Campus selector",
  description: "Campus switcher or cards",
  category: "Data",
  variants: [
    { id: "switcher", label: "Switcher", kind: "switcher" },
    { id: "cards", label: "Cards", kind: "cards" },
  ],
  aiHint: "A campus selection UI (dropdown or card grid).",
  aiProps: ["heading", "mode"],
  empty: () => emptyBlock("campusSelector") as never,
  Render: CampusSelectorRender as never,
  Inspector: CampusSelectorInspector as never,
  PaletteThumb: CampusSelectorThumb,
});
