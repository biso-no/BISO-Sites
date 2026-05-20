import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { StepGridRender } from "./render";
import { StepGridInspector } from "./inspector";
import { StepGridThumb } from "./thumb";

registerBlock({
  type: "stepGrid",
  label: "Steps",
  description: "Numbered how-it-works cards",
  category: "Layout",
  aiHint: "Numbered step cards showing a process or how-it-works flow.",
  aiProps: ["heading", "items"],
  empty: () => emptyBlock("stepGrid") as never,
  Render: StepGridRender as never,
  Inspector: StepGridInspector as never,
  PaletteThumb: StepGridThumb,
});
